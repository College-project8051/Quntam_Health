import { createServer } from 'http';
import multer from 'multer';
import { storage } from './storage.js';
import { encryptionService } from './services/encryption.js';
import { blockchainService } from './services/blockchain.js';
import { emailService } from './services/email.js';
import { insertUserSchema, insertDocumentAccessSchema, Notification, Suggestion, Message, Conversation, Appointment, DoctorAvailability } from './schemas.js';
import { z } from 'zod';

// Hardcoded admin credentials
const ADMIN_EMAIL = 'sjamadar@gmail.com';

// Notification helper service
const notificationService = {
  async create(userId, type, title, message, data = {}) {
    try {
      const notification = new Notification({
        userId: String(userId),
        type,
        title,
        message,
        data,
      });
      await notification.save();
      console.log(`[Notification] Created for user ${userId}: ${title}`);
      return notification;
    } catch (error) {
      console.error('[Notification] Error creating:', error);
    }
  },

  async notifyDocumentShared(ownerId, doctorId, documentName, doctorName) {
    await this.create(
      ownerId,
      'document_shared',
      'Document Shared',
      `Your document "${documentName}" has been shared with Dr. ${doctorName}`,
      { documentName, doctorName, doctorId }
    );
  },

  async notifyAccessGranted(doctorId, patientName, documentName) {
    await this.create(
      doctorId,
      'access_granted',
      'Access Granted',
      `${patientName} has granted you access to "${documentName}"`,
      { patientName, documentName }
    );
  },

  async notifyDocumentViewed(ownerId, viewerName, documentName) {
    await this.create(
      ownerId,
      'document_viewed',
      'Document Viewed',
      `Dr. ${viewerName} viewed your document "${documentName}"`,
      { viewerName, documentName }
    );
  },

  async notifyAccessRevoked(doctorId, patientName, documentName) {
    await this.create(
      doctorId,
      'access_revoked',
      'Access Revoked',
      `${patientName} has revoked your access to "${documentName}"`,
      { patientName, documentName }
    );
  },

  async notifyDoctorSuggestion(patientId, doctorName, documentName, priority) {
    await this.create(
      patientId,
      'doctor_suggestion',
      'New Doctor Suggestion',
      `Dr. ${doctorName} has provided a ${priority} priority suggestion for "${documentName}"`,
      { doctorName, documentName, priority }
    );
  }
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

async function registerRoutes(app) {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      let { name, aadhaarNumber, userType, city, email, firebaseUid } = req.body;

      // Check MongoDB connection
      const { mongoose } = await import('./db.js');
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          message: "Database not connected. Please start MongoDB or set MONGODB_URI environment variable."
        });
      }

      // Check if this is the admin email - automatically assign admin role
      const isAdminEmail = email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (isAdminEmail) {
        userType = 'admin';
        console.log('[Auth] Admin login detected for:', email);
      }

      // Prevent non-admin emails from being assigned admin role
      if (userType === 'admin' && !isAdminEmail) {
        return res.status(403).json({
          message: "You are not authorized to login as admin."
        });
      }

      // For Google login - check if user exists by firebaseUid first
      if (firebaseUid) {
        const existingUserByFirebase = await storage.getUserByFirebaseUid(firebaseUid);
        if (existingUserByFirebase) {
          // If admin email, always return as admin
          const effectiveUserType = isAdminEmail ? 'admin' : existingUserByFirebase.userType;

          // Update to admin if this is admin email but wasn't admin before
          if (isAdminEmail && existingUserByFirebase.userType !== 'admin') {
            const { User } = await import('./schemas.js');
            await User.findByIdAndUpdate(existingUserByFirebase._id, { userType: 'admin' });
          }

          // Return existing user
          return res.json({
            user: {
              id: String(existingUserByFirebase._id),
              name: existingUserByFirebase.name,
              userType: effectiveUserType,
              generatedId: existingUserByFirebase.generatedId,
              city: existingUserByFirebase.city,
            }
          });
        }
      }

      // For new registration or email login - require all fields
      if (!name || !aadhaarNumber || !userType || !city) {
        return res.status(400).json({
          message: "All fields are required",
          requiresAdditionalInfo: true
        });
      }

      // Check if user exists by Aadhaar
      let user = await storage.getUserByAadhaar(aadhaarNumber);

      if (user) {
        // If admin email, update user to admin
        if (isAdminEmail && user.userType !== 'admin') {
          const { User } = await import('./schemas.js');
          await User.findByIdAndUpdate(user._id, { userType: 'admin' });
          user.userType = 'admin';
        }

        // User exists - check if userType matches (skip for admin)
        if (!isAdminEmail && user.userType !== userType) {
          return res.status(403).json({
            message: `This Aadhaar is already registered as a ${user.userType}. You cannot login as a ${userType}.`,
            existingUserType: user.userType
          });
        }

        // Update firebaseUid if not set (linking Google account)
        if (firebaseUid && !user.firebaseUid) {
          await storage.updateUserFirebaseUid(user._id, firebaseUid);
        }
      } else {
        // Create new user
        const userData = insertUserSchema.parse({
          name,
          aadhaarNumber,
          userType,
          city,
          email: email || undefined,
          firebaseUid: firebaseUid || undefined,
        });

        user = await storage.createUser(userData);

        // Log user registration to blockchain
        await blockchainService.addBlock({
          userId: user._id,
          action: 'register',
          details: { userType, generatedId: user.generatedId, city },
          quantumStatus: 'secured',
        });
      }

      res.json({
        user: {
          id: String(user._id),
          name: user.name,
          userType: user.userType,
          generatedId: user.generatedId,
          city: user.city,
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error.message || "Authentication failed";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Check if Google user exists (for determining if additional info is needed)
  app.post("/api/auth/check-google-user", async (req, res) => {
    try {
      const { firebaseUid, userType } = req.body;

      console.log("[check-google-user] Request:", { firebaseUid, userType });

      if (!firebaseUid) {
        return res.status(400).json({ message: "Firebase UID is required" });
      }

      // Check MongoDB connection
      const { mongoose } = await import('./db.js');
      if (mongoose.connection.readyState !== 1) {
        console.error("[check-google-user] MongoDB not connected, state:", mongoose.connection.readyState);
        return res.status(503).json({ message: "Database not connected" });
      }

      const existingUser = await storage.getUserByFirebaseUid(firebaseUid);
      console.log("[check-google-user] Found user:", existingUser ? "yes" : "no");

      if (existingUser) {
        // Check userType match
        if (existingUser.userType !== userType) {
          return res.status(403).json({
            exists: true,
            message: `This Google account is already registered as a ${existingUser.userType}. You cannot login as a ${userType}.`,
            existingUserType: existingUser.userType
          });
        }
        return res.json({
          exists: true,
          user: {
            id: String(existingUser._id),
            name: existingUser.name,
            userType: existingUser.userType,
            generatedId: existingUser.generatedId,
            city: existingUser.city,
          }
        });
      }

      res.json({ exists: false, requiresAdditionalInfo: true });
    } catch (error) {
      console.error("Check Google user error:", error.message, error.stack);
      res.status(500).json({ message: "Failed to check user: " + error.message });
    }
  });

  // Search users
  app.get("/api/users/search", async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      const users = await storage.searchUsers(query);
      
      res.json({
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          userType: user.userType,
          generatedId: user.generatedId,
        }))
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Upload medical document
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    try {
      const { userId, documentType } = req.body;
      const file = req.file;
      
      if (!file || !userId || !documentType) {
        return res.status(400).json({ message: "File, user ID, and document type are required" });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Convert file to base64 and encrypt
      const fileData = file.buffer.toString('base64');
      const encryptionResult = await encryptionService.encryptData(fileData);
      
      // Store document (never store encryption key with encrypted data)
      const document = await storage.createDocument({
        ownerId: userId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size.toString(),
        documentType,
        encryptedData: encryptionResult.encryptedData,
        quantumKeyId: encryptionResult.quantumKeyId,
      });

      // Log to blockchain
      await blockchainService.logDocumentUpload(userId, document._id, file.originalname);

      // Send email notifications to doctors who have access to this patient's documents
      try {
        // Get all doctors who have been granted access by this patient
        const accessList = await storage.getAccessByGranter(userId);
        if (accessList && accessList.length > 0) {
          // Get unique doctor IDs
          const doctorIds = [...new Set(accessList.map(a => a.grantedToId))];

          for (const doctorId of doctorIds) {
            const doctor = await storage.getUser(doctorId);
            if (doctor && doctor.email) {
              await emailService.notifyDoctorDocumentUploaded(doctor.email, {
                doctorName: doctor.name,
                patientName: user.name,
                patientId: user.generatedId,
                documentName: file.originalname,
                documentType: documentType,
                uploadedAt: new Date().toLocaleString(),
                portalUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
              });
            }
          }
        }
      } catch (emailError) {
        console.error("Email notification error:", emailError);
        // Don't fail the upload if email fails
      }

      res.json({
        message: "Document uploaded and encrypted successfully",
        documentId: document._id,
        quantumKeyId: encryptionResult.quantumKeyId,
        bb84Stats: encryptionResult.bb84Stats,
        security: {
          algorithm: "AES-256-CBC",
          keyExchange: "BB84 QKD",
          quantumSecure: encryptionResult.bb84Stats.isSecure,
          qber: `${encryptionResult.bb84Stats.errorRate}%`,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Document upload failed" });
    }
  });

  // Delete a document (only owner can delete)
  app.post("/api/documents/:documentId/delete", async (req, res) => {
    try {
      const { documentId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get user to verify ownership
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Use MongoDB _id for ownership check
      const ownerId = user._id.toString();

      // Delete the document (storage method verifies ownership)
      const result = await storage.deleteDocument(documentId, ownerId);

      if (!result) {
        return res.status(403).json({ message: "Document not found or you don't have permission to delete it" });
      }

      res.json({
        message: "Document deleted successfully",
        documentId: documentId
      });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Get user documents
  app.get("/api/documents/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const documents = await storage.getDocumentsByOwner(userId);
      
      res.json({
        documents: documents.map(doc => ({
          id: doc._id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          documentType: doc.documentType,
          uploadedAt: doc.uploadedAt,
        }))
      });
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Failed to retrieve documents" });
    }
  });

  // NEW: Get documents granted to a user (doctor-visible list)
  app.get("/api/documents/granted/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      // Find active access records for this user
      const accessList = await storage.getActiveAccessByUser(userId);
      if (!accessList || accessList.length === 0) {
        return res.json({ documents: [] });
      }

      // Load documents referenced by the access records
      const docs = await Promise.all(
        accessList.map((a) => storage.getDocument(a.documentId))
      );

      const documents = docs.filter(Boolean).map((doc) => ({
        id: doc._id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        documentType: doc.documentType,
        uploadedAt: doc.uploadedAt,
      }));

      res.json({ documents });
    } catch (error) {
      console.error("Get granted documents error:", error);
      res.status(500).json({ message: "Failed to retrieve granted documents" });
    }
  });

  // View document (with access control)
  app.get("/api/documents/:documentId/view", async (req, res) => {
    try {
      const { documentId } = req.params;
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Normalize IDs for comparison
      const normalizedUserId = String(userId).trim();
      const normalizedOwnerId = String(document.ownerId).trim();

      // Check if user is owner or has access
      const isOwner = normalizedOwnerId === normalizedUserId;
      const accessRecord = await storage.getDocumentAccess(documentId, normalizedUserId);
      const hasAccess = isOwner || accessRecord;

      // Debug logging
      console.log('[View] documentId:', documentId);
      console.log('[View] userId (normalized):', normalizedUserId);
      console.log('[View] document.ownerId (normalized):', normalizedOwnerId);
      console.log('[View] isOwner:', isOwner);
      console.log('[View] accessRecord:', accessRecord);

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate quantum key
      const keyValid = await encryptionService.validateQuantumKey(document.quantumKeyId);
      if (!keyValid) {
        return res.status(403).json({ message: "Quantum key compromised - access denied" });
      }

      // Decrypt document
      const decryptedData = await encryptionService.decryptData(
        document.encryptedData,
        document.quantumKeyId
      );

      // Only log "Viewed" to blockchain when a doctor (not the owner) views the document
      if (!isOwner) {
        await blockchainService.logDocumentView(userId, documentId, document.fileName);

        // Send notification to document owner
        const viewer = await storage.getUser(userId);
        await notificationService.notifyDocumentViewed(
          normalizedOwnerId,
          viewer?.name || 'A doctor',
          document.fileName
        );
      }

      res.json({
        fileName: document.fileName,
        fileType: document.fileType,
        data: decryptedData,
      });
    } catch (error) {
      console.error("View document error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to view document";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Grant document access
  app.post("/api/documents/:documentId/grant", async (req, res) => {
    try {
      const { documentId } = req.params;
      const { granterId, doctorId } = req.body;
      
      if (!granterId || !doctorId) {
        return res.status(400).json({ message: "Granter ID and doctor ID are required" });
      }

      // Verify document exists and user is owner
      const document = await storage.getDocument(documentId);
      const normalizedGranterId = String(granterId).trim();
      const normalizedDocOwnerId = document ? String(document.ownerId).trim() : null;

      if (!document || normalizedDocOwnerId !== normalizedGranterId) {
        console.log('[Grant] Owner check failed - docOwner:', normalizedDocOwnerId, 'granter:', normalizedGranterId);
        return res.status(403).json({ message: "Not authorized to grant access" });
      }

      // Resolve doctor by _id or generatedId
      let doctor = await storage.getUser(doctorId);
      if (!doctor) {
        doctor = await storage.getUserByGeneratedId(doctorId);
      }
      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // Check if access already granted (by resolved doctor _id)
      const existingAccess = await storage.getDocumentAccess(documentId, doctor._id);
      if (existingAccess) {
        return res.status(400).json({ message: "Access already granted" });
      }

      // Grant access using resolved doctor _id (ensure string format)
      const resolvedDoctorId = String(doctor._id);
      console.log('[Grant] Granting access - documentId:', documentId, 'doctorId:', resolvedDoctorId);

      const accessData = insertDocumentAccessSchema.parse({
        documentId: String(documentId),
        grantedBy: String(granterId),
        grantedTo: resolvedDoctorId,
      });

      await storage.grantDocumentAccess(accessData);

      // Log to blockchain
      await blockchainService.logAccessGrant(granterId, doctor._id, documentId);

      // Send notifications
      const granter = await storage.getUser(granterId);
      await notificationService.notifyAccessGranted(
        resolvedDoctorId,
        granter?.name || 'A patient',
        document.fileName
      );

      // Send email notification to doctor
      if (doctor.email) {
        try {
          await emailService.notifyDoctorAccessGranted(doctor.email, {
            doctorName: doctor.name,
            patientName: granter?.name || 'A patient',
            patientId: granter?.generatedId || granterId,
            documentName: document.fileName,
            grantedAt: new Date().toLocaleString(),
            portalUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
          });
          console.log(`[Email] Access granted notification sent to doctor ${doctor.email}`);
        } catch (emailError) {
          console.error('[Email] Failed to send access granted notification:', emailError.message);
          // Don't fail the request if email fails
        }
      }

      res.json({ message: "Access granted successfully" });
    } catch (error) {
      console.error("Grant access error:", error);
      res.status(500).json({ message: "Failed to grant access" });
    }
  });

  // Revoke document access
  app.post("/api/documents/access/:accessId/revoke", async (req, res) => {
    try {
      const { accessId } = req.params;
      const { userId } = req.body;
      
      // Get access record
      const access = await storage.getAccessById(accessId);
      if (!access || access.grantedBy !== userId) {
        return res.status(403).json({ message: "Not authorized to revoke access" });
      }

      await storage.revokeDocumentAccess(accessId);

      // Log to blockchain
      await blockchainService.logAccessRevoke(
        access.grantedBy,
        access.grantedTo,
        access.documentId
      );

      // Send notification to the doctor
      const granter = await storage.getUser(access.grantedBy);
      const document = await storage.getDocument(access.documentId);
      await notificationService.notifyAccessRevoked(
        access.grantedTo,
        granter?.name || 'A patient',
        document?.fileName || 'a document'
      );

      res.json({ message: "Access revoked successfully" });
    } catch (error) {
      console.error("Revoke access error:", error);
      res.status(500).json({ message: "Failed to revoke access" });
    }
  });

  // Get user's granted access permissions
  app.get("/api/access/granted/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const accessList = await storage.getActiveAccessByUser(userId);
      
      res.json({ accessList });
    } catch (error) {
      console.error("Get access list error:", error);
      res.status(500).json({ message: "Failed to retrieve access list" });
    }
  });

  // NEW: Get access permissions granted by a user (patient view)
  app.get("/api/access/by-granter/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const accessRecords = await storage.getActiveAccessByGranter(userId);

      // Enrich with document and doctor info
      const enrichedAccessList = await Promise.all(
        accessRecords.map(async (access) => {
          const document = await storage.getDocument(access.documentId);
          const doctor = await storage.getUser(access.grantedTo);
          return {
            ...access,
            _id: access._id,
            id: access._id,
            documentName: document?.fileName || 'Unknown',
            doctorName: doctor?.name || 'Unknown',
            doctorGeneratedId: doctor?.generatedId || 'Unknown',
          };
        })
      );

      res.json({ accessList: enrichedAccessList });
    } catch (error) {
      console.error("Get by-granter access list error:", error);
      res.status(500).json({ message: "Failed to retrieve granted-by list" });
    }
  });

  // NEW: Get documents shared WITH a doctor
  app.get("/api/documents/shared/:doctorId", async (req, res) => {
    try {
      const { doctorId } = req.params;

      // Verify user is a doctor
      const doctor = await storage.getUser(doctorId);
      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Find active access records for this doctor
      const accessList = await storage.getActiveAccessByUser(doctorId);
      if (!accessList || accessList.length === 0) {
        return res.json({ documents: [] });
      }

      // Load documents and enrich with owner info
      const enrichedDocs = await Promise.all(
        accessList.map(async (access) => {
          const doc = await storage.getDocument(access.documentId);
          if (!doc) return null;
          const owner = await storage.getUser(doc.ownerId);
          return {
            id: doc._id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            documentType: doc.documentType,
            uploadedAt: doc.uploadedAt,
            ownerName: owner?.name || 'Unknown',
            ownerGeneratedId: owner?.generatedId || 'Unknown',
          };
        })
      );

      res.json({ documents: enrichedDocs.filter(Boolean) });
    } catch (error) {
      console.error("Get shared documents error:", error);
      res.status(500).json({ message: "Failed to retrieve shared documents" });
    }
  });

  // Get blockchain access history (with optional user filter)
  app.get("/api/blockchain/history", async (req, res) => {
    try {
      const { limit = 50, userId } = req.query;

      let history;
      if (userId && typeof userId === 'string') {
        // Get user-specific history (their actions + actions on their documents)
        history = await storage.getAccessHistoryByUserOrDocument(userId);
      } else {
        // Get all history
        history = await storage.getAccessHistory(parseInt(limit));
      }

      // Include user information
      const enrichedHistory = await Promise.all(
        history.map(async (entry) => {
          const user = await storage.getUser(entry.userId);
          const document = entry.documentId ? await storage.getDocument(entry.documentId) : null;

          return {
            ...entry,
            id: entry._id,
            userName: user?.name || 'Unknown',
            userGeneratedId: user?.generatedId || 'Unknown',
            documentName: document?.fileName || 'N/A',
          };
        })
      );

      res.json({ history: enrichedHistory });
    } catch (error) {
      console.error("Get blockchain history error:", error);
      res.status(500).json({ message: "Failed to retrieve blockchain history" });
    }
  });

  // Get blockchain statistics
  app.get("/api/blockchain/stats", async (req, res) => {
    try {
      const stats = await blockchainService.getBlockchainStats();
      res.json(stats);
    } catch (error) {
      console.error("Get blockchain stats error:", error);
      res.status(500).json({ message: "Failed to retrieve blockchain statistics" });
    }
  });

  // Get all doctors list
  app.get("/api/users/doctors", async (req, res) => {
    try {
      const doctors = await storage.getAllDoctors();

      res.json({
        doctors: doctors.map(doc => ({
          id: doc._id,
          generatedId: doc.generatedId,
          name: doc.name,
          phone: doc.phone || '',
          city: doc.city || '',
          specialty: doc.specialty || '',
          email: doc.email || '',
        }))
      });
    } catch (error) {
      console.error("Get doctors error:", error);
      res.status(500).json({ message: "Failed to retrieve doctors list" });
    }
  });

  // Get all patients list (for doctors to create appointments)
  app.get("/api/users/patients", async (req, res) => {
    try {
      const patients = await storage.getAllPatients();

      res.json({
        patients: patients.map(patient => ({
          id: patient._id,
          generatedId: patient.generatedId,
          name: patient.name,
          phone: patient.phone || '',
          city: patient.city || '',
          email: patient.email || '',
        }))
      });
    } catch (error) {
      console.error("Get patients error:", error);
      res.status(500).json({ message: "Failed to retrieve patients list" });
    }
  });

  // Get user profile
  app.get("/api/users/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ profile });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to retrieve profile" });
    }
  });

  // Update user profile
  app.put("/api/users/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const profileData = req.body;

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUserProfile(userId, profileData);

      // Log profile update to blockchain
      await blockchainService.addBlock({
        userId,
        action: 'profile_update',
        details: { fields: Object.keys(profileData) },
        quantumStatus: 'secured',
      });

      res.json({
        message: "Profile updated successfully",
        profile: {
          name: updatedUser.name,
          email: updatedUser.email || '',
          phone: updatedUser.phone || '',
          address: updatedUser.address || '',
          dateOfBirth: updatedUser.dateOfBirth || '',
          bloodGroup: updatedUser.bloodGroup || '',
          emergencyContact: updatedUser.emergencyContact || '',
          emergencyPhone: updatedUser.emergencyPhone || '',
          allergies: updatedUser.allergies || '',
          medicalNotes: updatedUser.medicalNotes || '',
          specialty: updatedUser.specialty || '',
        }
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ============================================
  // Notification Routes
  // ============================================

  // Get user notifications
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 50, unreadOnly } = req.query;

      let query = { userId: String(userId) };
      if (unreadOnly === 'true') {
        query.isRead = false;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      const unreadCount = await Notification.countDocuments({
        userId: String(userId),
        isRead: false
      });

      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Failed to retrieve notifications" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:notificationId/read", async (req, res) => {
    try {
      const { notificationId } = req.params;

      await Notification.findByIdAndUpdate(notificationId, { isRead: true });

      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // Mark all notifications as read for a user
  app.put("/api/notifications/:userId/read-all", async (req, res) => {
    try {
      const { userId } = req.params;

      await Notification.updateMany(
        { userId: String(userId), isRead: false },
        { isRead: true }
      );

      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Failed to update notifications" });
    }
  });

  // Delete a notification
  app.delete("/api/notifications/:notificationId", async (req, res) => {
    try {
      const { notificationId } = req.params;

      await Notification.findByIdAndDelete(notificationId);

      res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // ============================================
  // Doctor Suggestion Routes
  // ============================================

  // Create a suggestion for a document (Doctor only)
  app.post("/api/suggestions", async (req, res) => {
    try {
      const { documentId, doctorId, diagnosis, suggestion, prescription, followUpDate, priority } = req.body;

      if (!documentId || !doctorId || !suggestion) {
        return res.status(400).json({ message: "Document ID, Doctor ID, and suggestion are required" });
      }

      // Verify doctor exists and is a doctor
      const doctor = await storage.getUser(doctorId);
      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(403).json({ message: "Only doctors can create suggestions" });
      }

      // Verify document exists
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Verify doctor has access to this document
      const accessRecord = await storage.getDocumentAccess(documentId, doctorId);
      if (!accessRecord) {
        return res.status(403).json({ message: "You don't have access to this document" });
      }

      // Create the suggestion
      const newSuggestion = new Suggestion({
        documentId: String(documentId),
        patientId: String(document.ownerId),
        doctorId: String(doctorId),
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty || '',
        diagnosis: diagnosis || '',
        suggestion,
        prescription: prescription || '',
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        priority: priority || 'medium',
      });

      await newSuggestion.save();

      // Log to blockchain
      await blockchainService.addBlock({
        userId: doctorId,
        action: 'suggestion_created',
        details: { documentId, patientId: document.ownerId, priority },
        quantumStatus: 'secured',
        documentId,
      });

      // Notify the patient (in-app notification)
      await notificationService.notifyDoctorSuggestion(
        document.ownerId,
        doctor.name,
        document.fileName,
        priority || 'medium'
      );

      // Send email notification to patient
      try {
        const patient = await storage.getUser(document.ownerId);
        if (patient && patient.email) {
          await emailService.notifyPatientSuggestionReceived(patient.email, {
            patientName: patient.name,
            doctorName: doctor.name,
            doctorSpecialty: doctor.specialty || '',
            documentName: document.fileName,
            diagnosis: diagnosis || '',
            suggestion: suggestion,
            prescription: prescription || '',
            followUpDate: followUpDate ? new Date(followUpDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : '',
            priority: priority || 'medium',
            portalUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
          });
        }
      } catch (emailError) {
        console.error("Email notification error:", emailError);
        // Don't fail the suggestion if email fails
      }

      res.json({
        message: "Suggestion created successfully",
        suggestion: newSuggestion
      });
    } catch (error) {
      console.error("Create suggestion error:", error);
      res.status(500).json({ message: "Failed to create suggestion" });
    }
  });

  // Get suggestions for a patient (Patient view)
  app.get("/api/suggestions/patient/:patientId", async (req, res) => {
    try {
      const { patientId } = req.params;

      const suggestions = await Suggestion.find({ patientId: String(patientId) })
        .sort({ createdAt: -1 })
        .lean();

      // Enrich with document info
      const enrichedSuggestions = await Promise.all(
        suggestions.map(async (sug) => {
          const document = await storage.getDocument(sug.documentId);
          return {
            ...sug,
            id: sug._id,
            documentName: document?.fileName || 'Unknown',
            documentType: document?.documentType || 'Unknown',
          };
        })
      );

      res.json({ suggestions: enrichedSuggestions });
    } catch (error) {
      console.error("Get patient suggestions error:", error);
      res.status(500).json({ message: "Failed to retrieve suggestions" });
    }
  });

  // Get suggestions created by a doctor (Doctor view)
  app.get("/api/suggestions/doctor/:doctorId", async (req, res) => {
    try {
      const { doctorId } = req.params;

      const suggestions = await Suggestion.find({ doctorId: String(doctorId) })
        .sort({ createdAt: -1 })
        .lean();

      // Enrich with document and patient info
      const enrichedSuggestions = await Promise.all(
        suggestions.map(async (sug) => {
          const document = await storage.getDocument(sug.documentId);
          const patient = await storage.getUser(sug.patientId);
          return {
            ...sug,
            id: sug._id,
            documentName: document?.fileName || 'Unknown',
            documentType: document?.documentType || 'Unknown',
            patientName: patient?.name || 'Unknown',
            patientGeneratedId: patient?.generatedId || 'Unknown',
          };
        })
      );

      res.json({ suggestions: enrichedSuggestions });
    } catch (error) {
      console.error("Get doctor suggestions error:", error);
      res.status(500).json({ message: "Failed to retrieve suggestions" });
    }
  });

  // Get suggestions for a specific document
  app.get("/api/suggestions/document/:documentId", async (req, res) => {
    try {
      const { documentId } = req.params;
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Verify user has access to this document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const isOwner = String(document.ownerId) === String(userId);
      const accessRecord = await storage.getDocumentAccess(documentId, userId);

      if (!isOwner && !accessRecord) {
        return res.status(403).json({ message: "Access denied" });
      }

      const suggestions = await Suggestion.find({ documentId: String(documentId) })
        .sort({ createdAt: -1 })
        .lean();

      res.json({ suggestions });
    } catch (error) {
      console.error("Get document suggestions error:", error);
      res.status(500).json({ message: "Failed to retrieve suggestions" });
    }
  });

  // Mark suggestion as read (Patient)
  app.put("/api/suggestions/:suggestionId/read", async (req, res) => {
    try {
      const { suggestionId } = req.params;

      await Suggestion.findByIdAndUpdate(suggestionId, { isRead: true });

      res.json({ message: "Suggestion marked as read" });
    } catch (error) {
      console.error("Mark suggestion read error:", error);
      res.status(500).json({ message: "Failed to update suggestion" });
    }
  });

  // Send email notification for a suggestion (Doctor action)
  app.post("/api/suggestions/:suggestionId/send-email", async (req, res) => {
    try {
      const { suggestionId } = req.params;

      // Get the suggestion
      const suggestion = await Suggestion.findById(suggestionId).lean();
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }

      // Get patient details
      const patient = await storage.getUser(suggestion.patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (!patient.email) {
        return res.status(400).json({ message: "Patient does not have an email address registered" });
      }

      // Get doctor details
      const doctor = await storage.getUser(suggestion.doctorId);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // Get document details
      const document = await storage.getDocument(suggestion.documentId);

      // Send email
      const result = await emailService.notifyPatientSuggestionReceived(patient.email, {
        patientName: patient.name,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty || '',
        documentName: document?.fileName || 'Medical Document',
        diagnosis: suggestion.diagnosis || '',
        suggestion: suggestion.suggestion,
        prescription: suggestion.prescription || '',
        followUpDate: suggestion.followUpDate ? new Date(suggestion.followUpDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : '',
        priority: suggestion.priority || 'medium',
        portalUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      });

      if (result.success) {
        res.json({
          message: "Email sent successfully to patient",
          email: patient.email
        });
      } else {
        res.status(500).json({
          message: "Failed to send email",
          reason: result.reason
        });
      }
    } catch (error) {
      console.error("Send suggestion email error:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // ============================================
  // Admin Routes
  // ============================================

  // Check if user is admin middleware helper
  const isAdmin = async (userId) => {
    const { User } = await import('./schemas.js');
    const user = await User.findById(userId).lean();
    return user?.userType === 'admin';
  };

  // Clear all data (Admin) - USE WITH CAUTION
  app.delete("/api/admin/clear-all", async (req, res) => {
    try {
      const { User, Document, DocumentAccess, AccessHistory, QuantumKey } = await import('./schemas.js');

      // Delete all data
      await User.deleteMany({});
      await Document.deleteMany({});
      await DocumentAccess.deleteMany({});
      await AccessHistory.deleteMany({});
      await QuantumKey.deleteMany({});

      console.log("[Admin] All data cleared from database");
      res.json({ message: "All data cleared successfully" });
    } catch (error) {
      console.error("[Admin Clear] Error:", error);
      res.status(500).json({ message: "Failed to clear data: " + error.message });
    }
  });

  // Get all users (Admin)
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();

      res.json({
        users: users.map(user => ({
          id: String(user._id),
          generatedId: user.generatedId,
          name: user.name,
          email: user.email || '',
          userType: user.userType,
          city: user.city || '',
          phone: user.phone || '',
          createdAt: user.createdAt,
        }))
      });
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ message: "Failed to retrieve users" });
    }
  });

  // Get admin statistics
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ message: "Failed to retrieve statistics" });
    }
  });

  // Delete user (Admin)
  app.delete("/api/admin/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      console.log("[Admin Delete] Received userId:", userId);

      // Import models and mongoose
      const { User, Document, DocumentAccess } = await import('./schemas.js');
      const { mongoose } = await import('./db.js');

      let user = null;

      // Check if it's a valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(userId) && userId.length === 24) {
        user = await User.findById(userId).lean();
      }

      // If not found, try other fields
      if (!user) {
        user = await User.findOne({
          $or: [
            { generatedId: userId },
            { firebaseUid: userId },
            { email: userId }
          ]
        }).lean();
      }

      if (!user) {
        console.log("[Admin Delete] User not found for ID:", userId);
        return res.status(404).json({ message: "User not found" });
      }

      const userIdStr = String(user._id);
      console.log("[Admin Delete] Found user:", user.name, "MongoDB ID:", userIdStr);

      // Delete user's documents
      await Document.deleteMany({ ownerId: userIdStr });

      // Delete access records
      await DocumentAccess.deleteMany({
        $or: [{ grantedBy: userIdStr }, { grantedTo: userIdStr }]
      });

      // Delete the user
      await User.findByIdAndDelete(user._id);

      console.log("[Admin Delete] User deleted successfully:", user.name);

      // Log to blockchain
      await blockchainService.addBlock({
        userId: 'admin',
        action: 'user_deleted',
        details: {
          deletedUserId: userIdStr,
          deletedUserName: user.name,
          deletedUserType: user.userType
        },
        quantumStatus: 'secured',
      });

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("[Admin Delete] Error:", error);
      res.status(500).json({ message: "Failed to delete user: " + error.message });
    }
  });

  // ============================================
  // Messaging Routes (Secure Chat)
  // ============================================

  // Helper function to generate conversation ID
  const generateConversationId = (userId1, userId2) => {
    const sorted = [String(userId1), String(userId2)].sort();
    return `conv_${sorted[0]}_${sorted[1]}`;
  };

  // Get or create conversation between two users
  app.post("/api/conversations", async (req, res) => {
    try {
      const { patientId, doctorId } = req.body;

      if (!patientId || !doctorId) {
        return res.status(400).json({ message: "Patient ID and Doctor ID are required" });
      }

      // Verify users exist
      const patient = await storage.getUser(patientId);
      const doctor = await storage.getUser(doctorId);

      if (!patient || !doctor) {
        return res.status(404).json({ message: "User not found" });
      }

      const conversationId = generateConversationId(patientId, doctorId);

      // Check if conversation exists
      let conversation = await Conversation.findOne({
        $or: [
          { patientId: String(patientId), doctorId: String(doctorId) },
          { patientId: String(doctorId), doctorId: String(patientId) }
        ]
      });

      if (!conversation) {
        conversation = new Conversation({
          participantIds: [String(patientId), String(doctorId)],
          participantNames: [patient.name, doctor.name],
          patientId: String(patientId),
          doctorId: String(doctorId),
          unreadCount: new Map([[String(patientId), 0], [String(doctorId), 0]]),
        });
        await conversation.save();
      }

      res.json({
        conversation: {
          id: conversation._id,
          conversationId: generateConversationId(patientId, doctorId),
          patientId: conversation.patientId,
          doctorId: conversation.doctorId,
          patientName: patient.name,
          doctorName: doctor.name,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
        }
      });
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get all conversations for a user
  app.get("/api/conversations/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const conversations = await Conversation.find({
        $or: [
          { patientId: String(userId) },
          { doctorId: String(userId) }
        ],
        isActive: true
      }).sort({ lastMessageAt: -1 }).lean();

      // Enrich with user details
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const otherUserId = conv.patientId === String(userId) ? conv.doctorId : conv.patientId;
          const otherUser = await storage.getUser(otherUserId);
          const unreadCount = conv.unreadCount?.get?.(String(userId)) || conv.unreadCount?.[String(userId)] || 0;

          return {
            id: conv._id,
            conversationId: generateConversationId(conv.patientId, conv.doctorId),
            otherUserId,
            otherUserName: otherUser?.name || 'Unknown',
            otherUserType: otherUser?.userType || 'unknown',
            otherUserSpecialty: otherUser?.specialty || '',
            lastMessage: conv.lastMessage,
            lastMessageAt: conv.lastMessageAt,
            unreadCount,
          };
        })
      );

      res.json({ conversations: enrichedConversations });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ message: "Failed to retrieve conversations" });
    }
  });

  // Send a message
  app.post("/api/messages", async (req, res) => {
    try {
      const { senderId, receiverId, content, attachments } = req.body;

      if (!senderId || !receiverId || !content) {
        return res.status(400).json({ message: "Sender ID, Receiver ID, and content are required" });
      }

      // Get sender and receiver details
      const sender = await storage.getUser(senderId);
      const receiver = await storage.getUser(receiverId);

      if (!sender || !receiver) {
        return res.status(404).json({ message: "User not found" });
      }

      const conversationId = generateConversationId(senderId, receiverId);

      // Encrypt the message content
      let encryptedContent = content;
      let encryptionKeyId = null;

      try {
        const encryptResult = await encryptionService.encrypt(content);
        encryptedContent = encryptResult.encryptedData;
        encryptionKeyId = encryptResult.keyId;
      } catch (encError) {
        console.warn("Message encryption failed, storing as plain text:", encError.message);
      }

      // Create message
      const message = new Message({
        conversationId,
        senderId: String(senderId),
        senderName: sender.name,
        senderType: sender.userType,
        receiverId: String(receiverId),
        receiverName: receiver.name,
        content: encryptedContent,
        isEncrypted: !!encryptionKeyId,
        encryptionKeyId,
        attachments: attachments || [],
      });

      await message.save();

      // Update conversation
      const patientId = sender.userType === 'patient' ? senderId : receiverId;
      const doctorId = sender.userType === 'doctor' ? senderId : receiverId;

      await Conversation.findOneAndUpdate(
        {
          $or: [
            { patientId: String(patientId), doctorId: String(doctorId) },
            { patientId: String(doctorId), doctorId: String(patientId) }
          ]
        },
        {
          $set: {
            lastMessage: content.substring(0, 100),
            lastMessageAt: new Date(),
          },
          $inc: {
            [`unreadCount.${receiverId}`]: 1
          },
          $setOnInsert: {
            participantIds: [String(patientId), String(doctorId)],
            participantNames: [sender.userType === 'patient' ? sender.name : receiver.name, sender.userType === 'doctor' ? sender.name : receiver.name],
            patientId: String(patientId),
            doctorId: String(doctorId),
          }
        },
        { upsert: true, new: true }
      );

      // Create notification for receiver
      await notificationService.create(
        receiverId,
        'system',
        `New message from ${sender.name}`,
        content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        { senderId, conversationId }
      );

      res.json({
        message: {
          id: message._id,
          conversationId,
          senderId: message.senderId,
          senderName: message.senderName,
          content: content, // Return original content to sender
          createdAt: message.createdAt,
          attachments: message.attachments,
        }
      });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Get messages for a conversation
  app.get("/api/messages/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { userId } = req.query;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          let decryptedContent = msg.content;

          if (msg.isEncrypted && msg.encryptionKeyId) {
            try {
              decryptedContent = await encryptionService.decrypt(msg.content, msg.encryptionKeyId);
            } catch (decError) {
              console.warn("Message decryption failed:", decError.message);
              decryptedContent = "[Encrypted Message]";
            }
          }

          return {
            id: msg._id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            senderName: msg.senderName,
            senderType: msg.senderType,
            receiverId: msg.receiverId,
            content: decryptedContent,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
            attachments: msg.attachments,
          };
        })
      );

      // Mark messages as read
      await Message.updateMany(
        { conversationId, receiverId: String(userId), isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );

      // Reset unread count for this user - extract user IDs from conversationId
      // conversationId format: conv_userId1_userId2
      const convParts = conversationId.replace('conv_', '').split('_');
      if (convParts.length >= 2) {
        const conv = await Conversation.findOne({
          $or: [
            { patientId: convParts[0], doctorId: convParts[1] },
            { patientId: convParts[1], doctorId: convParts[0] }
          ]
        });

        if (conv) {
          // Update using the proper Map set syntax
          if (conv.unreadCount instanceof Map) {
            conv.unreadCount.set(String(userId), 0);
          } else {
            conv.unreadCount = new Map([[String(userId), 0]]);
          }
          await conv.save();
          console.log(`[Messages] Reset unread count for user ${userId} in conversation`);
        }
      }

      res.json({ messages: decryptedMessages.reverse() });
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Failed to retrieve messages" });
    }
  });

  // Upload attachment for chat
  app.post("/api/messages/attachment", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { senderId } = req.body;
      if (!senderId) {
        return res.status(400).json({ message: "Sender ID is required" });
      }

      // Encrypt the file
      const fileBuffer = req.file.buffer;
      const base64Data = fileBuffer.toString('base64');

      let encryptedData = base64Data;
      let encryptionKeyId = null;

      try {
        const encryptResult = await encryptionService.encrypt(base64Data);
        encryptedData = encryptResult.encryptedData;
        encryptionKeyId = encryptResult.keyId;
      } catch (encError) {
        console.warn("Attachment encryption failed:", encError.message);
      }

      const attachment = {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        encryptedData,
        encryptionKeyId,
        uploadedAt: new Date(),
      };

      res.json({ attachment });
    } catch (error) {
      console.error("Upload attachment error:", error);
      res.status(500).json({ message: "Failed to upload attachment" });
    }
  });

  // ============================================
  // Appointment Booking Routes
  // ============================================

  // Set doctor availability
  app.post("/api/doctor/availability", async (req, res) => {
    try {
      const { doctorId, availability } = req.body;

      if (!doctorId || !availability) {
        return res.status(400).json({ message: "Doctor ID and availability are required" });
      }

      // Verify doctor exists
      const doctor = await storage.getUser(doctorId);
      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(403).json({ message: "Only doctors can set availability" });
      }

      // Delete existing availability and insert new
      await DoctorAvailability.deleteMany({ doctorId: String(doctorId) });

      const availabilityDocs = availability.map(slot => ({
        doctorId: String(doctorId),
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotDuration: slot.slotDuration || 30,
        isAvailable: slot.isAvailable !== false,
      }));

      await DoctorAvailability.insertMany(availabilityDocs);

      res.json({ message: "Availability updated successfully" });
    } catch (error) {
      console.error("Set availability error:", error);
      res.status(500).json({ message: "Failed to set availability" });
    }
  });

  // Get doctor availability
  app.get("/api/doctor/:doctorId/availability", async (req, res) => {
    try {
      const { doctorId } = req.params;

      const availability = await DoctorAvailability.find({
        doctorId: String(doctorId),
        isAvailable: true
      }).lean();

      res.json({ availability });
    } catch (error) {
      console.error("Get availability error:", error);
      res.status(500).json({ message: "Failed to retrieve availability" });
    }
  });

  // Get available time slots for a doctor on a specific date
  app.get("/api/doctor/:doctorId/slots", async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();

      // Get doctor's availability for this day
      const availability = await DoctorAvailability.findOne({
        doctorId: String(doctorId),
        dayOfWeek,
        isAvailable: true
      }).lean();

      if (!availability) {
        return res.json({ slots: [], message: "Doctor is not available on this day" });
      }

      // Get existing appointments for this date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointments = await Appointment.find({
        doctorId: String(doctorId),
        appointmentDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['cancelled', 'no-show'] }
      }).lean();

      const bookedSlots = existingAppointments.map(apt => apt.startTime);

      // Generate available slots
      const slots = [];
      const [startHour, startMin] = availability.startTime.split(':').map(Number);
      const [endHour, endMin] = availability.endTime.split(':').map(Number);
      const slotDuration = availability.slotDuration || 30;

      let currentTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      while (currentTime + slotDuration <= endTime) {
        const hour = Math.floor(currentTime / 60);
        const minute = currentTime % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        const endSlotTime = currentTime + slotDuration;
        const endHourSlot = Math.floor(endSlotTime / 60);
        const endMinSlot = endSlotTime % 60;
        const endTimeStr = `${endHourSlot.toString().padStart(2, '0')}:${endMinSlot.toString().padStart(2, '0')}`;

        slots.push({
          startTime: timeStr,
          endTime: endTimeStr,
          isBooked: bookedSlots.includes(timeStr),
        });

        currentTime += slotDuration;
      }

      res.json({ slots });
    } catch (error) {
      console.error("Get slots error:", error);
      res.status(500).json({ message: "Failed to retrieve slots" });
    }
  });

  // Book an appointment
  app.post("/api/appointments", async (req, res) => {
    try {
      const { patientId, doctorId, appointmentDate, startTime, endTime, type, reason, notes } = req.body;

      if (!patientId || !doctorId || !appointmentDate || !startTime) {
        return res.status(400).json({ message: "Patient ID, Doctor ID, appointment date, and start time are required" });
      }

      // Verify users exist
      const patient = await storage.getUser(patientId);
      const doctor = await storage.getUser(doctorId);

      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // Check if slot is available
      const appointmentDateObj = new Date(appointmentDate);
      const startOfDay = new Date(appointmentDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(appointmentDateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        doctorId: String(doctorId),
        appointmentDate: { $gte: startOfDay, $lte: endOfDay },
        startTime,
        status: { $nin: ['cancelled', 'no-show'] }
      });

      if (existingAppointment) {
        return res.status(409).json({ message: "This time slot is already booked" });
      }

      // Create appointment
      const appointment = new Appointment({
        patientId: String(patientId),
        patientName: patient.name,
        doctorId: String(doctorId),
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty || '',
        appointmentDate: appointmentDateObj,
        startTime,
        endTime: endTime || calculateEndTime(startTime, 30),
        type: type || 'in-person',
        reason: reason || '',
        patientNotes: notes || '',
      });

      await appointment.save();

      // Notify doctor
      await notificationService.create(
        doctorId,
        'system',
        'New Appointment Booked',
        `${patient.name} has booked an appointment for ${new Date(appointmentDate).toLocaleDateString()} at ${startTime}`,
        { appointmentId: appointment._id, patientId }
      );

      // Send email to doctor
      if (doctor.email) {
        try {
          await emailService.sendEmail(doctor.email, {
            subject: `New Appointment - ${patient.name}`,
            html: `
              <h2>New Appointment Booked</h2>
              <p>Dear Dr. ${doctor.name},</p>
              <p>${patient.name} has booked an appointment with you.</p>
              <p><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${startTime}</p>
              <p><strong>Type:</strong> ${type || 'In-person'}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>Please log in to the portal to view details.</p>
            `,
            text: `New appointment booked by ${patient.name} on ${new Date(appointmentDate).toLocaleDateString()} at ${startTime}.`
          });
        } catch (emailError) {
          console.error("Appointment email error:", emailError.message);
        }
      }

      res.json({
        message: "Appointment booked successfully",
        appointment: {
          id: appointment._id,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          appointmentDate: appointment.appointmentDate,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          type: appointment.type,
          status: appointment.status,
        }
      });
    } catch (error) {
      console.error("Book appointment error:", error);
      res.status(500).json({ message: "Failed to book appointment" });
    }
  });

  // Helper function to calculate end time
  function calculateEndTime(startTime, durationMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  // Doctor creates custom appointment (with any time)
  app.post("/api/appointments/doctor-create", async (req, res) => {
    try {
      const { doctorId, patientId, appointmentDate, startTime, endTime, type, reason, notes, duration } = req.body;

      if (!doctorId || !patientId || !appointmentDate || !startTime) {
        return res.status(400).json({ message: "Doctor ID, Patient ID, appointment date, and start time are required" });
      }

      // Verify users exist
      const doctor = await storage.getUser(doctorId);
      const patient = await storage.getUser(patientId);

      if (!doctor || doctor.userType !== 'doctor') {
        return res.status(404).json({ message: "Doctor not found" });
      }
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const appointmentDateObj = new Date(appointmentDate);
      const finalEndTime = endTime || calculateEndTime(startTime, duration || 30);

      // Create appointment with confirmed status (doctor created it)
      const appointment = new Appointment({
        patientId: String(patientId),
        patientName: patient.name,
        doctorId: String(doctorId),
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty || '',
        appointmentDate: appointmentDateObj,
        startTime,
        endTime: finalEndTime,
        duration: duration || 30,
        type: type || 'in-person',
        reason: reason || '',
        doctorNotes: notes || '',
        status: 'confirmed', // Auto-confirm since doctor created it
        confirmedAt: new Date(),
      });

      await appointment.save();

      // Notify patient
      await notificationService.create(
        patientId,
        'system',
        'Appointment Scheduled by Doctor',
        `Dr. ${doctor.name} has scheduled an appointment with you for ${appointmentDateObj.toLocaleDateString()} at ${startTime}`,
        { appointmentId: appointment._id, doctorId }
      );

      // Send email to patient
      if (patient.email) {
        try {
          await emailService.sendEmail(patient.email, {
            subject: `Appointment Scheduled - Dr. ${doctor.name}`,
            html: `
              <h2>Appointment Scheduled</h2>
              <p>Dear ${patient.name},</p>
              <p>Dr. ${doctor.name} has scheduled an appointment with you.</p>
              <p><strong>Date:</strong> ${appointmentDateObj.toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${startTime} - ${finalEndTime}</p>
              <p><strong>Type:</strong> ${type || 'In-person'}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>Please log in to the portal to view details.</p>
            `,
            text: `Appointment scheduled by Dr. ${doctor.name} on ${appointmentDateObj.toLocaleDateString()} at ${startTime}.`
          });
        } catch (emailError) {
          console.error("Appointment email error:", emailError.message);
        }
      }

      res.json({
        message: "Appointment created successfully",
        appointment: {
          id: appointment._id,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          appointmentDate: appointment.appointmentDate,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          type: appointment.type,
          status: appointment.status,
        }
      });
    } catch (error) {
      console.error("Doctor create appointment error:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  // Get appointments for a user (patient or doctor)
  app.get("/api/appointments/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, upcoming } = req.query;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let query = {};
      if (user.userType === 'doctor') {
        query.doctorId = String(userId);
      } else {
        query.patientId = String(userId);
      }

      if (status) {
        query.status = status;
      }

      if (upcoming === 'true') {
        query.appointmentDate = { $gte: new Date() };
        query.status = { $in: ['scheduled', 'confirmed'] };
      }

      const appointments = await Appointment.find(query)
        .sort({ appointmentDate: 1, startTime: 1 })
        .lean();

      res.json({ appointments });
    } catch (error) {
      console.error("Get appointments error:", error);
      res.status(500).json({ message: "Failed to retrieve appointments" });
    }
  });

  // Update appointment status
  app.put("/api/appointments/:appointmentId/status", async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { status, userId, cancelReason, doctorNotes } = req.body;

      if (!status || !userId) {
        return res.status(400).json({ message: "Status and User ID are required" });
      }

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      const updateData = { status };

      if (status === 'cancelled') {
        updateData.cancelledBy = userId;
        updateData.cancelReason = cancelReason || '';
        updateData.cancelledAt = new Date();
      } else if (status === 'confirmed') {
        updateData.confirmedAt = new Date();
      } else if (status === 'completed') {
        updateData.completedAt = new Date();
        if (doctorNotes) {
          updateData.doctorNotes = doctorNotes;
        }
      }

      await Appointment.findByIdAndUpdate(appointmentId, updateData);

      // Notify the other party
      const notifyUserId = String(userId) === String(appointment.patientId)
        ? appointment.doctorId
        : appointment.patientId;

      const statusMessages = {
        confirmed: 'Your appointment has been confirmed',
        cancelled: 'Your appointment has been cancelled',
        completed: 'Your appointment has been marked as completed',
        rescheduled: 'Your appointment has been rescheduled',
      };

      if (statusMessages[status]) {
        await notificationService.create(
          notifyUserId,
          'system',
          `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          `${statusMessages[status]} for ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.startTime}`,
          { appointmentId }
        );
      }

      res.json({ message: `Appointment ${status} successfully` });
    } catch (error) {
      console.error("Update appointment error:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // Reschedule appointment
  app.put("/api/appointments/:appointmentId/reschedule", async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { newDate, newStartTime, userId } = req.body;

      if (!newDate || !newStartTime || !userId) {
        return res.status(400).json({ message: "New date, time, and user ID are required" });
      }

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      // Check if new slot is available
      const newDateObj = new Date(newDate);
      const startOfDay = new Date(newDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(newDateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        _id: { $ne: appointmentId },
        doctorId: appointment.doctorId,
        appointmentDate: { $gte: startOfDay, $lte: endOfDay },
        startTime: newStartTime,
        status: { $nin: ['cancelled', 'no-show'] }
      });

      if (existingAppointment) {
        return res.status(409).json({ message: "This time slot is already booked" });
      }

      await Appointment.findByIdAndUpdate(appointmentId, {
        appointmentDate: newDateObj,
        startTime: newStartTime,
        endTime: calculateEndTime(newStartTime, appointment.duration || 30),
        status: 'rescheduled',
      });

      // Notify the other party
      const notifyUserId = String(userId) === String(appointment.patientId)
        ? appointment.doctorId
        : appointment.patientId;

      await notificationService.create(
        notifyUserId,
        'system',
        'Appointment Rescheduled',
        `Your appointment has been rescheduled to ${newDateObj.toLocaleDateString()} at ${newStartTime}`,
        { appointmentId }
      );

      res.json({ message: "Appointment rescheduled successfully" });
    } catch (error) {
      console.error("Reschedule appointment error:", error);
      res.status(500).json({ message: "Failed to reschedule appointment" });
    }
  });

  // Get appointment history for a patient-doctor pair
  app.get("/api/appointments/history/:patientId/:doctorId", async (req, res) => {
    try {
      const { patientId, doctorId } = req.params;

      const appointments = await Appointment.find({
        patientId: String(patientId),
        doctorId: String(doctorId),
      }).sort({ appointmentDate: -1 }).lean();

      res.json({ appointments });
    } catch (error) {
      console.error("Get appointment history error:", error);
      res.status(500).json({ message: "Failed to retrieve appointment history" });
    }
  });

  // ============================================
  // AI Chatbot Routes
  // ============================================

  // AI Chat endpoint using kimi-k2 model
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { userId, message, conversationHistory } = req.body;

      if (!userId || !message) {
        return res.status(400).json({ message: "User ID and message are required" });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Gather context from database
      const dbContext = await gatherAIContext(userId, user);

      // Build system prompt with context
      const systemPrompt = buildAISystemPrompt(dbContext, user);

      // Call Kimi K2 API with context for fallback
      const aiResponse = await callKimiK2API(systemPrompt, message, conversationHistory || [], dbContext);

      res.json({ response: aiResponse });
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({
        message: "Failed to process AI request",
        response: "I apologize, but I'm having trouble processing your request right now. Please try again later or contact our support team for assistance."
      });
    }
  });

  // Helper function to gather context from database
  async function gatherAIContext(userId, user) {
    const context = {
      userInfo: {
        name: user.name,
        userType: user.userType,
        city: user.city,
      },
      appointments: [],
      doctors: [],
      documents: [],
      suggestions: [],
      hospitalInfo: {
        name: "Quantum Healthcare",
        services: [
          "Secure Medical Records Storage",
          "Quantum-Encrypted Document Management",
          "Doctor-Patient Messaging",
          "Appointment Booking",
          "Medical Document Sharing",
          "AI Health Assistance",
        ],
        features: [
          "BB84 Quantum Key Distribution for encryption",
          "Blockchain-based access logging",
          "Real-time notifications",
          "Secure video consultations",
        ],
      },
    };

    try {
      // Get user's appointments
      const appointments = await Appointment.find({
        $or: [
          { patientId: String(userId) },
          { doctorId: String(userId) }
        ]
      }).sort({ appointmentDate: -1 }).limit(10).lean();
      context.appointments = appointments.map(apt => ({
        doctorName: apt.doctorName,
        patientName: apt.patientName,
        date: apt.appointmentDate,
        time: apt.startTime,
        status: apt.status,
        type: apt.type,
      }));

      // Get available doctors
      const doctors = await storage.getAllDoctors();
      context.doctors = doctors.map(doc => ({
        name: doc.name,
        specialty: doc.specialty || 'General',
        city: doc.city || '',
      }));

      // Get user's documents count
      const documents = await storage.getDocumentsByOwner(userId);
      context.documents = {
        count: documents.length,
        types: [...new Set(documents.map(d => d.documentType))],
      };

      // Get suggestions for patient
      if (user.userType === 'patient') {
        const suggestions = await Suggestion.find({ patientId: String(userId) })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        context.suggestions = suggestions.map(sug => ({
          doctorName: sug.doctorName,
          suggestion: sug.suggestion,
          priority: sug.priority,
          createdAt: sug.createdAt,
        }));
      }
    } catch (error) {
      console.error("Error gathering AI context:", error);
    }

    return context;
  }

  // Helper function to build system prompt
  function buildAISystemPrompt(context, user) {
    return `You are Quantum AI, a dedicated healthcare assistant for the Quantum Healthcare platform. You ONLY answer questions related to this healthcare platform and its features.

## IMPORTANT RESTRICTION
- You can ONLY answer questions about the Quantum Healthcare platform
- If a user asks about unrelated topics (like "what is DBMS?", "explain Python", "what is AI?", etc.), you MUST respond with:
  "🤖 I am Quantum AI. I can only answer questions related to the Quantum Healthcare platform. I can help you with booking appointments, managing documents, finding doctors, messaging, and understanding our security features. Please ask me something about the platform!"
- Do NOT answer general knowledge questions, programming questions, or anything not related to this platform

## About Quantum Healthcare
- ${context.hospitalInfo.name} is a secure healthcare platform
- Services: ${context.hospitalInfo.services.join(', ')}
- Key Features: ${context.hospitalInfo.features.join(', ')}

## Current User Information
- Name: ${context.userInfo.name}
- Role: ${context.userInfo.userType}
- City: ${context.userInfo.city || 'Not specified'}

## User's Data Summary
- Total Documents: ${context.documents.count || 0}
- Document Types: ${context.documents.types?.join(', ') || 'None'}
- Upcoming Appointments: ${context.appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length}
- Recent Suggestions: ${context.suggestions.length || 0}

## Available Doctors
${context.doctors.map(d => `- Dr. ${d.name} (${d.specialty})${d.city ? ` - ${d.city}` : ''}`).join('\n') || 'No doctors available'}

## Recent Appointments
${context.appointments.slice(0, 5).map(a => `- ${a.doctorName || a.patientName} on ${new Date(a.date).toLocaleDateString()} at ${a.time} - Status: ${a.status}`).join('\n') || 'No appointments found'}

## What You CAN Help With
1. Booking appointments with doctors
2. Managing medical documents (upload, view, share)
3. Finding available doctors
4. Messaging healthcare providers
5. Understanding quantum security features of the platform
6. Viewing doctor suggestions and recommendations
7. Profile and notification settings
8. Platform navigation and features

## Guidelines for Responses
1. Be helpful, empathetic, and professional
2. ONLY answer platform-related questions
3. For unrelated questions, politely decline and explain you only help with platform features
4. Keep responses concise but informative
5. Use the context provided to personalize responses
6. For medical advice, recommend consulting with a doctor

## Platform Navigation Help
- To book an appointment: Go to "Find Doctors" or "Appointments" section
- To view medical records: Go to "My Documents" section
- To message a doctor: Go to "Messages" section or click "Message" on a doctor's profile
- To view suggestions from doctors: Check "Suggestions" in the dashboard
- To update profile: Go to "Profile" section`;
  }

  // Helper function to call Kimi K2 via local Ollama
  async function callKimiK2API(systemPrompt, userMessage, conversationHistory, context = null) {
    try {
      // Build messages array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      // Ollama API endpoint (local)
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const modelName = process.env.OLLAMA_MODEL || 'kimi-k2';

      console.log(`[AI Chat] Calling Ollama at ${ollamaUrl} with model ${modelName}`);

      // Call local Ollama API (OpenAI-compatible endpoint)
      const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024,
          stream: false,
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Ollama API error:', response.status, errorData);

        // Try alternative Ollama endpoint format
        const altResponse = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: messages,
            stream: false,
            options: {
              temperature: 0.7,
            }
          })
        });

        if (!altResponse.ok) {
          console.error('Ollama alternative API also failed, using fallback with context');
          return generateFallbackResponse(userMessage, context);
        }

        const altData = await altResponse.json();
        return altData.message?.content || generateFallbackResponse(userMessage, context);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || generateFallbackResponse(userMessage, context);
    } catch (error) {
      console.error('Ollama API call failed:', error.message);
      return generateFallbackResponse(userMessage, context);
    }
  }

  // Fallback response generator when API is unavailable
  // This version uses context from database
  function generateFallbackResponse(userMessage, context = null) {
    const lowerMessage = userMessage.toLowerCase();

    // Check if asking about available doctors
    if (lowerMessage.includes('doctor') && (lowerMessage.includes('available') || lowerMessage.includes('list') || lowerMessage.includes('which') || lowerMessage.includes('who'))) {
      if (context && context.doctors && context.doctors.length > 0) {
        let response = `🏥 **Available Doctors at Quantum Healthcare:**\n\n`;
        context.doctors.forEach((doc, index) => {
          // Remove "Dr." prefix if already present in name
          const doctorName = doc.name.replace(/^Dr\.?\s*/i, '');
          response += `${index + 1}. **${doctorName}**`;
          if (doc.specialty) response += `\n   🩺 ${doc.specialty}`;
          if (doc.city) response += `\n   📍 ${doc.city}`;
          response += `\n\n`;
        });
        response += `---\n💡 **Quick Actions:**\n• Go to "Find Doctors" to view profiles\n• Click "Book Appointment" to schedule\n• Click "Message" to chat with a doctor`;
        return response;
      }
      return `Currently, there are no doctors registered in the system. Please check back later or contact support.`;
    }

    if (lowerMessage.includes('appointment') || lowerMessage.includes('book')) {
      let response = `To book an appointment with a doctor:\n\n1. Go to the "Find Doctors" section from the menu\n2. Browse available doctors or search by specialty\n3. Click on a doctor's profile to view their availability\n4. Select a convenient date and time slot\n5. Confirm your booking`;

      if (context && context.appointments && context.appointments.length > 0) {
        const upcoming = context.appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed');
        if (upcoming.length > 0) {
          response += `\n\n**Your Upcoming Appointments:**\n`;
          upcoming.slice(0, 3).forEach((apt, index) => {
            response += `${index + 1}. Dr. ${apt.doctorName} - ${new Date(apt.date).toLocaleDateString()} at ${apt.time}\n`;
          });
        }
      }
      return response;
    }

    if (lowerMessage.includes('message') || lowerMessage.includes('chat') || lowerMessage.includes('contact')) {
      let response = `To message a doctor:\n\n1. Go to the "Messages" section from the menu\n2. If you have existing conversations, you'll see them listed\n3. To start a new conversation, go to "Find Doctors", select a doctor, and click the "Message" button\n\nAll messages are encrypted for your security using quantum-safe encryption.`;

      if (context && context.doctors && context.doctors.length > 0) {
        response += `\n\n**Available doctors to message:**\n`;
        context.doctors.slice(0, 5).forEach((doc) => {
          response += `• Dr. ${doc.name}${doc.specialty ? ` (${doc.specialty})` : ''}\n`;
        });
      }
      return response;
    }

    if (lowerMessage.includes('document') || lowerMessage.includes('record') || lowerMessage.includes('upload')) {
      let response = `To manage your medical documents:\n\n1. Go to "My Documents" section\n2. To upload a new document, click the upload button and select your file\n3. Your documents are encrypted using BB84 quantum key distribution\n4. You can share documents with doctors by granting them access\n5. Track who has viewed your documents in the activity log`;

      if (context && context.documents) {
        response += `\n\n**Your Documents:** ${context.documents.count || 0} file(s)`;
        if (context.documents.types && context.documents.types.length > 0) {
          response += `\nTypes: ${context.documents.types.join(', ')}`;
        }
      }
      return response;
    }

    if (lowerMessage.includes('find') || lowerMessage.includes('search')) {
      let response = `To find doctors:\n\n1. Go to the "Find Doctors" section from the menu\n2. You can search doctors by name or specialty\n3. Click on a doctor's card to view their full profile\n4. From the profile, you can:\n   - Send them a message\n   - Book an appointment\n   - View their availability`;

      if (context && context.doctors && context.doctors.length > 0) {
        response += `\n\n**Currently Available Doctors:**\n`;
        context.doctors.forEach((doc) => {
          response += `• Dr. ${doc.name}${doc.specialty ? ` - ${doc.specialty}` : ''}${doc.city ? ` (${doc.city})` : ''}\n`;
        });
      }
      return response;
    }

    if (lowerMessage.includes('suggestion') || lowerMessage.includes('recommendation')) {
      let response = `Doctor suggestions are medical recommendations provided by your doctors after reviewing your documents.\n\nTo view suggestions:\n1. Go to the "Suggestions" section in your dashboard\n2. You'll see all recommendations from your doctors\n3. Each suggestion includes diagnosis, prescription, and follow-up advice`;

      if (context && context.suggestions && context.suggestions.length > 0) {
        response += `\n\n**Your Recent Suggestions:** ${context.suggestions.length}\n`;
        context.suggestions.slice(0, 3).forEach((sug) => {
          response += `• From Dr. ${sug.doctorName}: ${sug.suggestion.substring(0, 50)}...\n`;
        });
      }
      return response;
    }

    if (lowerMessage.includes('security') || lowerMessage.includes('encrypt') || lowerMessage.includes('safe')) {
      return `Quantum Healthcare uses state-of-the-art security:\n\n• BB84 Quantum Key Distribution for encryption\n• All documents are encrypted before storage\n• Blockchain-based access logging\n• End-to-end encrypted messaging\n• Secure access control for document sharing\n\nYour medical data is protected with quantum-safe encryption that cannot be broken even by future quantum computers.`;
    }

    // Logout question
    if (lowerMessage.includes('logout') || lowerMessage.includes('log out') || lowerMessage.includes('sign out') || lowerMessage.includes('signout')) {
      return `🔐 **To Logout Securely:**\n\n1. Click on your **profile icon** in the top-right corner of the sidebar\n2. Click the **"Logout"** button\n3. You will be securely logged out and redirected to the login page\n\n✅ **Security Features:**\n• Your session is immediately terminated\n• All cached data is cleared\n• You'll need to login again to access your account\n\n💡 Always logout when using a shared or public computer!`;
    }

    // Profile question
    if (lowerMessage.includes('profile') || lowerMessage.includes('update') && (lowerMessage.includes('name') || lowerMessage.includes('email') || lowerMessage.includes('phone'))) {
      return `👤 **To Update Your Profile:**\n\n1. Click on your **profile icon** in the sidebar\n2. Select **"Profile"** from the menu\n3. Update your information:\n   • Name, Email, Phone\n   • Address, Date of Birth\n   • Blood Group\n   • Emergency Contact\n   • Medical Notes & Allergies\n4. Click **"Save Changes"**\n\n✅ All profile updates are logged securely on the blockchain.`;
    }

    // Notification question
    if (lowerMessage.includes('notification') || lowerMessage.includes('alert') || lowerMessage.includes('notify')) {
      return `🔔 **Notifications:**\n\nYou receive notifications for:\n• New messages from doctors\n• Appointment confirmations & reminders\n• Document access requests\n• Doctor suggestions on your records\n\n**To View Notifications:**\n1. Click the **bell icon** 🔔 in the header\n2. Click any notification to view details\n3. Use "Mark all read" to clear them\n\n🔊 You can toggle notification sounds on/off from the notification panel.`;
    }

    // General help - but not if asking specific "how" questions
    if (lowerMessage === 'help' || lowerMessage === 'hi' || lowerMessage === 'hello' || lowerMessage === 'hey') {
      return `👋 Hello! I'm here to help you with Quantum Healthcare!\n\n**Here's what you can do:**\n\n📋 **Documents** - Upload, view, and share medical records\n👨‍⚕️ **Find Doctors** - Search and connect with healthcare providers\n📅 **Appointments** - Book and manage appointments\n💬 **Messages** - Securely chat with your doctors\n📝 **Suggestions** - View doctor recommendations\n🔐 **Security** - Your data is quantum-encrypted\n\nWhat would you like help with?`;
    }

    // Default response - restrict to platform-related questions only
    return `🤖 **I am Quantum AI**\n\nI can only answer questions related to the **Quantum Healthcare platform**.\n\n**I can help you with:**\n• 📅 Booking appointments with doctors\n• 📋 Managing your medical documents\n• 💬 Messaging healthcare providers\n• 👨‍⚕️ Finding available doctors\n• 🔐 Understanding our quantum security features\n• 📝 Viewing doctor suggestions\n\nPlease ask me something about the platform and I'll be happy to help!`;
  }

  // ============================================
  // Video Consultation Routes
  // ============================================

  // In-memory storage for video call rooms and signals
  const videoRooms = new Map();
  const videoSignals = new Map();

  // Create or join video room
  app.post("/api/video/join", async (req, res) => {
    try {
      const { roomId, userId, userName, userType } = req.body;

      if (!roomId || !userId || !userName) {
        return res.status(400).json({ message: "Room ID, User ID, and User Name are required" });
      }

      // Get or create room
      let room = videoRooms.get(roomId);
      if (!room) {
        room = {
          id: roomId,
          participants: [],
          createdAt: new Date(),
        };
        videoRooms.set(roomId, room);
      }

      // Add participant if not already in room
      const existingParticipant = room.participants.find(p => p.userId === userId);
      if (!existingParticipant) {
        room.participants.push({
          userId,
          userName,
          userType,
          joinedAt: new Date(),
        });
      }

      // Initialize signals array for this room if not exists
      if (!videoSignals.has(roomId)) {
        videoSignals.set(roomId, []);
      }

      console.log(`[Video] User ${userName} joined room ${roomId}`);

      res.json({
        success: true,
        room: {
          id: room.id,
          participants: room.participants,
        },
      });
    } catch (error) {
      console.error("Video join error:", error);
      res.status(500).json({ message: "Failed to join video room" });
    }
  });

  // Send signal (offer, answer, ice-candidate)
  app.post("/api/video/signal", async (req, res) => {
    try {
      const { roomId, sender, type, data } = req.body;

      if (!roomId || !sender || !type) {
        return res.status(400).json({ message: "Room ID, sender, and type are required" });
      }

      // Get or create signals array for room
      if (!videoSignals.has(roomId)) {
        videoSignals.set(roomId, []);
      }

      const signals = videoSignals.get(roomId);

      // Add signal
      signals.push({
        sender,
        type,
        data,
        timestamp: new Date(),
      });

      // Keep only last 100 signals per room to prevent memory issues
      if (signals.length > 100) {
        signals.splice(0, signals.length - 100);
      }

      console.log(`[Video] Signal ${type} from ${sender} in room ${roomId}`);

      res.json({ success: true });
    } catch (error) {
      console.error("Video signal error:", error);
      res.status(500).json({ message: "Failed to send signal" });
    }
  });

  // Get signals for a room (polling)
  app.get("/api/video/signals/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { userId, since } = req.query;

      if (!roomId) {
        return res.status(400).json({ message: "Room ID is required" });
      }

      const signals = videoSignals.get(roomId) || [];

      // Filter signals not from this user and after the given timestamp
      const filteredSignals = signals.filter(s => {
        if (s.sender === userId) return false;
        if (since && new Date(s.timestamp) <= new Date(since)) return false;
        return true;
      });

      res.json({ signals: filteredSignals });
    } catch (error) {
      console.error("Get signals error:", error);
      res.status(500).json({ message: "Failed to get signals" });
    }
  });

  // Leave video room
  app.post("/api/video/leave", async (req, res) => {
    try {
      const { roomId, userId } = req.body;

      if (!roomId || !userId) {
        return res.status(400).json({ message: "Room ID and User ID are required" });
      }

      const room = videoRooms.get(roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.userId !== userId);

        // Clean up empty rooms
        if (room.participants.length === 0) {
          videoRooms.delete(roomId);
          videoSignals.delete(roomId);
        }
      }

      console.log(`[Video] User ${userId} left room ${roomId}`);

      res.json({ success: true });
    } catch (error) {
      console.error("Video leave error:", error);
      res.status(500).json({ message: "Failed to leave video room" });
    }
  });

  // Get room info
  app.get("/api/video/room/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;

      const room = videoRooms.get(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json({ room });
    } catch (error) {
      console.error("Get room error:", error);
      res.status(500).json({ message: "Failed to get room info" });
    }
  });

  // Create video consultation room from appointment
  app.post("/api/video/create-from-appointment", async (req, res) => {
    try {
      const { appointmentId } = req.body;

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      if (appointment.type !== 'video') {
        return res.status(400).json({ message: "This appointment is not a video consultation" });
      }

      // Create room ID from appointment
      const roomId = `video_${appointmentId}`;

      // Initialize room
      videoRooms.set(roomId, {
        id: roomId,
        appointmentId,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        participants: [],
        createdAt: new Date(),
      });

      videoSignals.set(roomId, []);

      console.log(`[Video] Created room ${roomId} for appointment ${appointmentId}`);

      res.json({
        success: true,
        roomId,
        appointment: {
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          appointmentDate: appointment.appointmentDate,
          startTime: appointment.startTime,
        },
      });
    } catch (error) {
      console.error("Create video room error:", error);
      res.status(500).json({ message: "Failed to create video room" });
    }
  });

  // ============================================
  // Direct Call Routes (for Messaging)
  // ============================================

  // In-memory storage for direct calls
  const activeCalls = new Map();
  const callSignals = new Map();

  // Create a direct call
  app.post("/api/call/create", async (req, res) => {
    try {
      const { roomId, callerId, callerName, callerType, receiverId, receiverName, receiverType, callType } = req.body;

      if (!roomId || !callerId || !receiverId) {
        return res.status(400).json({ message: "Room ID, Caller ID, and Receiver ID are required" });
      }

      // Store the call
      activeCalls.set(roomId, {
        roomId,
        callerId,
        callerName,
        callerType,
        receiverId,
        receiverName,
        receiverType,
        callType,
        status: "ringing",
        createdAt: new Date(),
      });

      // Initialize signals for this call
      callSignals.set(roomId, []);

      console.log(`[Call] ${callerName} calling ${receiverName} (${callType})`);

      res.json({ success: true, roomId });
    } catch (error) {
      console.error("Create call error:", error);
      res.status(500).json({ message: "Failed to create call" });
    }
  });

  // Check for incoming calls
  app.get("/api/call/incoming/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      // Find any active calls where this user is the receiver
      let incomingCall = null;
      for (const [roomId, call] of activeCalls.entries()) {
        if (call.receiverId === userId && call.status === "ringing") {
          incomingCall = call;
          break;
        }
      }

      if (incomingCall) {
        res.json({ call: incomingCall });
      } else {
        res.json({ call: null });
      }
    } catch (error) {
      console.error("Check incoming call error:", error);
      res.status(500).json({ message: "Failed to check incoming calls" });
    }
  });

  // Send call signal
  app.post("/api/call/signal", async (req, res) => {
    try {
      const { roomId, sender, type, data } = req.body;

      if (!roomId || !sender || !type) {
        return res.status(400).json({ message: "Room ID, sender, and type are required" });
      }

      // Get or create signals array for this room
      if (!callSignals.has(roomId)) {
        callSignals.set(roomId, []);
      }

      const signals = callSignals.get(roomId);
      signals.push({
        sender,
        type,
        data,
        timestamp: new Date(),
      });

      // Handle special signal types
      if (type === "accept") {
        const call = activeCalls.get(roomId);
        if (call) {
          call.status = "connected";
        }
      } else if (type === "reject" || type === "end-call") {
        // Clean up call after a delay
        setTimeout(() => {
          activeCalls.delete(roomId);
          callSignals.delete(roomId);
        }, 5000);
      }

      console.log(`[Call] Signal ${type} from ${sender} in room ${roomId}`);

      res.json({ success: true });
    } catch (error) {
      console.error("Call signal error:", error);
      res.status(500).json({ message: "Failed to send signal" });
    }
  });

  // Get call signals
  app.get("/api/call/signals/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { userId } = req.query;

      const signals = callSignals.get(roomId) || [];

      // Filter signals not from the requesting user
      const filteredSignals = signals.filter(s => s.sender !== userId);

      // Clear delivered signals for this user
      if (filteredSignals.length > 0) {
        const remainingSignals = signals.filter(s => s.sender === userId);
        callSignals.set(roomId, remainingSignals);
      }

      res.json({ signals: filteredSignals });
    } catch (error) {
      console.error("Get call signals error:", error);
      res.status(500).json({ message: "Failed to get signals" });
    }
  });

  // End call
  app.post("/api/call/end", async (req, res) => {
    try {
      const { roomId } = req.body;

      activeCalls.delete(roomId);
      callSignals.delete(roomId);

      console.log(`[Call] Call ended: ${roomId}`);

      res.json({ success: true });
    } catch (error) {
      console.error("End call error:", error);
      res.status(500).json({ message: "Failed to end call" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

export { registerRoutes };