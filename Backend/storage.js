import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import {
  User,
  Document,
  DocumentAccess,
  AccessHistory,
  QuantumKey
} from './schemas.js';

/**
 * Storage interface implementation using MongoDB/Mongoose
 */
class DatabaseStorage {
  // Helper to check if string is valid ObjectId
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) &&
           (String(new mongoose.Types.ObjectId(id)) === id);
  }

  // User operations
  async getUser(id) {
    // Try findById only if it's a valid ObjectId
    if (this.isValidObjectId(id)) {
      const user = await User.findById(id).lean();
      if (user) return user;
    }
    // Fallback: try to find by firebaseUid or generatedId
    const user = await User.findOne({
      $or: [{ firebaseUid: id }, { generatedId: id }]
    }).lean();
    return user;
  }

  async getUserByAadhaar(aadhaarNumber) {
    const user = await User.findOne({ aadhaarNumber }).lean();
    return user;
  }

  async getUserByGeneratedId(generatedId) {
    const user = await User.findOne({ generatedId }).lean();
    return user;
  }

  async getUserByFirebaseUid(firebaseUid) {
    const user = await User.findOne({ firebaseUid }).lean();
    return user;
  }

  async updateUserFirebaseUid(userId, firebaseUid) {
    if (this.isValidObjectId(userId)) {
      await User.findByIdAndUpdate(userId, { firebaseUid });
    } else {
      await User.findOneAndUpdate(
        { $or: [{ firebaseUid: userId }, { generatedId: userId }] },
        { firebaseUid }
      );
    }
  }

  async createUser(insertUser) {
    // Generate user ID based on type
    const prefix = insertUser.userType === 'patient' ? 'PAT' : 'DOC';
    const generatedId = `${prefix}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

    const user = new User({
      name: insertUser.name,
      aadhaarNumber: insertUser.aadhaarNumber,
      userType: insertUser.userType,
      city: insertUser.city,
      email: insertUser.email,
      firebaseUid: insertUser.firebaseUid,
      generatedId,
    });

    const savedUser = await user.save();
    return savedUser.toObject();
  }

  // Document operations
  async getDocument(id) {
    if (this.isValidObjectId(id)) {
      const document = await Document.findById(id).lean();
      return document;
    }
    return null;
  }

  async getDocumentsByOwner(ownerId) {
    const normalizedOwnerId = String(ownerId).trim();
    const documents = await Document.find({ ownerId: normalizedOwnerId }).lean();
    return documents;
  }

  async createDocument(insertDocument) {
    const document = new Document(insertDocument);
    const savedDocument = await document.save();
    return savedDocument.toObject();
  }

  // Delete a document by ID (only owner can delete)
  async deleteDocument(documentId, ownerId) {
    if (!this.isValidObjectId(documentId)) {
      console.log("[Storage deleteDocument] Invalid document ID:", documentId);
      return null;
    }

    const normalizedOwnerId = String(ownerId).trim();

    // Find the document and verify ownership
    const document = await Document.findById(documentId).lean();
    if (!document) {
      console.log("[Storage deleteDocument] Document not found:", documentId);
      return null;
    }

    if (document.ownerId !== normalizedOwnerId) {
      console.log("[Storage deleteDocument] Owner mismatch:", document.ownerId, "!==", normalizedOwnerId);
      return null;
    }

    // Delete associated access records
    await DocumentAccess.deleteMany({ documentId: documentId });
    console.log("[Storage deleteDocument] Deleted access records for document:", documentId);

    // Delete the document
    const result = await Document.findByIdAndDelete(documentId);
    console.log("[Storage deleteDocument] Document deleted:", result ? "success" : "failed");

    return result;
  }

  // Access control operations
  async getAccessById(accessId) {
    if (this.isValidObjectId(accessId)) {
      const access = await DocumentAccess.findById(accessId).lean();
      return access;
    }
    return null;
  }

  async getDocumentAccess(documentId, userId) {
    // Normalize IDs - trim whitespace and ensure string
    const normalizedDocId = String(documentId).trim();
    const normalizedUserId = String(userId).trim();

    // Debug logging
    console.log('[getDocumentAccess] Looking for documentId:', normalizedDocId, 'userId:', normalizedUserId);

    // Try exact match first
    let access = await DocumentAccess.findOne({
      documentId: normalizedDocId,
      grantedTo: normalizedUserId,
      isActive: true
    }).lean();

    // If not found, try to find any active access for this document
    if (!access) {
      const allAccessForDoc = await DocumentAccess.find({
        documentId: normalizedDocId,
        isActive: true
      }).lean();

      console.log('[getDocumentAccess] All active access records for document:', allAccessForDoc);

      // Check if any record matches the userId (with string normalization)
      access = allAccessForDoc.find(a =>
        String(a.grantedTo).trim() === normalizedUserId
      );

      if (!access && allAccessForDoc.length > 0) {
        console.log('[getDocumentAccess] Found access records but none match userId:', normalizedUserId);
        console.log('[getDocumentAccess] Available grantedTo values:', allAccessForDoc.map(a => a.grantedTo));
      }
    }

    return access;
  }

  async getActiveAccessByDocument(documentId) {
    const accessList = await DocumentAccess.find({
      documentId,
      isActive: true
    }).lean();
    return accessList;
  }

  async getActiveAccessByUser(userId) {
    const normalizedUserId = String(userId).trim();
    console.log('[getActiveAccessByUser] Looking for userId:', normalizedUserId);

    const accessList = await DocumentAccess.find({
      grantedTo: normalizedUserId,
      isActive: true
    }).lean();

    console.log('[getActiveAccessByUser] Found', accessList.length, 'access records');
    return accessList;
  }

  // NEW: Access records granted by a specific user (patient side)
  async getActiveAccessByGranter(userId) {
    const accessList = await DocumentAccess.find({
      grantedBy: userId,
      isActive: true
    }).lean();
    return accessList;
  }

  async grantDocumentAccess(insertAccess) {
    // Normalize all IDs before storing
    const normalizedAccess = {
      ...insertAccess,
      documentId: String(insertAccess.documentId).trim(),
      grantedBy: String(insertAccess.grantedBy).trim(),
      grantedTo: String(insertAccess.grantedTo).trim(),
    };

    console.log('[grantDocumentAccess] Storing access:', normalizedAccess);

    const access = new DocumentAccess(normalizedAccess);
    const savedAccess = await access.save();
    return savedAccess.toObject();
  }

  async revokeDocumentAccess(id) {
    if (this.isValidObjectId(id)) {
      await DocumentAccess.findByIdAndUpdate(id, {
        isActive: false,
        revokedAt: new Date()
      });
    }
  }

  // Access history operations
  async getAccessHistory(limit = 50) {
    const history = await AccessHistory.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return history;
  }

  async getAccessHistoryByUser(userId) {
    const history = await AccessHistory.find({ userId })
      .sort({ timestamp: -1 })
      .lean();
    return history;
  }

  // Get access history filtered by user (for their own documents or actions)
  async getAccessHistoryByUserOrDocument(userId) {
    // Get user's document IDs
    const userDocs = await this.getDocumentsByOwner(userId);
    const docIds = userDocs.map(d => d._id.toString());

    // Get the user to check their type
    const user = await this.getUser(userId);
    const isDoctor = user?.userType === 'doctor';

    // Get all history entries for this user or their documents
    // For doctors: show their own actions
    // For patients: show actions on their documents (but exclude suggestion_created which is doctor-only)
    let query;
    if (isDoctor) {
      // Doctors see their own actions only
      query = { userId: userId };
    } else {
      // Patients see their own actions AND actions on their documents
      // But exclude doctor-only actions like suggestion_created on their documents
      query = {
        $or: [
          { userId: userId },
          {
            documentId: { $in: docIds },
            action: { $nin: ['suggestion_created'] } // Exclude doctor-only actions
          }
        ]
      };
    }

    const history = await AccessHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return history;
  }

  async logAccess(insertHistory) {
    // Generate blockchain hash (simulation)
    const blockHash = randomUUID().replace(/-/g, '').substring(0, 16);
    
    // Get previous block hash
    const lastBlock = await AccessHistory.findOne()
      .sort({ timestamp: -1 })
      .select('blockHash')
      .lean();
    
    const historyEntry = new AccessHistory({
      ...insertHistory,
      blockHash,
      previousHash: lastBlock?.blockHash || '0000000000000000',
    });
    
    const savedHistory = await historyEntry.save();
    return savedHistory.toObject();
  }

  // Log access with pre-computed hash for blockchain consistency
  async logAccessWithHash(insertHistory) {
    const historyEntry = new AccessHistory(insertHistory);
    const savedHistory = await historyEntry.save();
    return savedHistory.toObject();
  }

  // Quantum key operations
  async getQuantumKey(keyId) {
    const key = await QuantumKey.findOne({ keyId }).lean();
    return key;
  }

  async createQuantumKey(insertKey) {
    const key = new QuantumKey(insertKey);
    const savedKey = await key.save();
    return savedKey.toObject();
  }

  async markKeyCompromised(keyId) {
    await QuantumKey.findOneAndUpdate(
      { keyId },
      { isCompromised: true }
    );
  }

  // Search operations
  async searchUsers(query) {
    const users = await User.find({
      generatedId: query.toUpperCase()
    }).lean();
    return users;
  }

  // Profile operations
  async getUserProfile(userId) {
    let user = null;
    if (this.isValidObjectId(userId)) {
      user = await User.findById(userId).lean();
    }
    if (!user) {
      user = await User.findOne({
        $or: [{ firebaseUid: userId }, { generatedId: userId }]
      }).lean();
    }
    if (!user) return null;

    return {
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      dateOfBirth: user.dateOfBirth || '',
      bloodGroup: user.bloodGroup || '',
      emergencyContact: user.emergencyContact || '',
      emergencyPhone: user.emergencyPhone || '',
      allergies: user.allergies || '',
      medicalNotes: user.medicalNotes || '',
      specialty: user.specialty || '',
    };
  }

  // Get all doctors
  async getAllDoctors() {
    const doctors = await User.find({ userType: 'doctor' })
      .select('_id generatedId name phone city specialty email')
      .sort({ name: 1 })
      .lean();
    return doctors;
  }

  // Get all patients
  async getAllPatients() {
    const patients = await User.find({ userType: 'patient' })
      .select('_id generatedId name phone city email')
      .sort({ name: 1 })
      .lean();
    return patients;
  }

  // Admin: Get all users with full details
  async getAllUsers() {
    const users = await User.find()
      .select('_id generatedId name email userType city phone createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return users;
  }

  // Admin: Get user statistics
  async getUserStats() {
    const totalUsers = await User.countDocuments();
    const totalDoctors = await User.countDocuments({ userType: 'doctor' });
    const totalPatients = await User.countDocuments({ userType: 'patient' });
    const totalDocuments = await Document.countDocuments();
    const totalAccessRecords = await DocumentAccess.countDocuments({ isActive: true });

    // Get users registered per day for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const usersByDay = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            userType: "$userType"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);

    // Get monthly registration data for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const usersByMonth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            userType: "$userType"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.month": 1 }
      }
    ]);

    // Get document uploads by type
    const documentsByType = await Document.aggregate([
      {
        $group: {
          _id: "$documentType",
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      totalUsers,
      totalDoctors,
      totalPatients,
      totalDocuments,
      totalAccessRecords,
      usersByDay,
      usersByMonth,
      documentsByType
    };
  }

  // Admin: Delete user by ID
  async deleteUser(userId) {
    const normalizedId = String(userId).trim();
    console.log("[Storage deleteUser] Deleting user:", normalizedId);

    if (this.isValidObjectId(normalizedId)) {
      // First delete user's documents
      const docsDeleted = await Document.deleteMany({ ownerId: normalizedId });
      console.log("[Storage deleteUser] Documents deleted:", docsDeleted.deletedCount);

      // Delete access records where user is granter or grantee
      const accessDeleted = await DocumentAccess.deleteMany({
        $or: [{ grantedBy: normalizedId }, { grantedTo: normalizedId }]
      });
      console.log("[Storage deleteUser] Access records deleted:", accessDeleted.deletedCount);

      // Delete the user
      const result = await User.findByIdAndDelete(normalizedId);
      console.log("[Storage deleteUser] User deleted:", result ? "success" : "not found");
      return result;
    }

    console.log("[Storage deleteUser] Invalid ObjectId:", normalizedId);
    return null;
  }

  async updateUserProfile(userId, profileData) {
    const updateFields = {
      name: profileData.name,
      email: profileData.email,
      phone: profileData.phone,
      address: profileData.address,
      dateOfBirth: profileData.dateOfBirth,
      bloodGroup: profileData.bloodGroup,
      emergencyContact: profileData.emergencyContact,
      emergencyPhone: profileData.emergencyPhone,
      allergies: profileData.allergies,
      medicalNotes: profileData.medicalNotes,
      specialty: profileData.specialty,
    };

    // Remove undefined fields
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined) {
        delete updateFields[key];
      }
    });

    let updatedUser = null;
    if (this.isValidObjectId(userId)) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { new: true }
      ).lean();
    } else {
      updatedUser = await User.findOneAndUpdate(
        { $or: [{ firebaseUid: userId }, { generatedId: userId }] },
        { $set: updateFields },
        { new: true }
      ).lean();
    }

    return updatedUser;
  }
}

const storage = new DatabaseStorage();

export { DatabaseStorage, storage };