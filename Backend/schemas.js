import mongoose from 'mongoose';
import { z } from 'zod';

// ============================================
// Mongoose Schemas and Models
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  aadhaarNumber: { type: String, required: true, unique: true },
  userType: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
  city: { type: String, required: true },
  email: { type: String },
  firebaseUid: { type: String },
  generatedId: { type: String, unique: true },
  phone: { type: String },
  address: { type: String },
  dateOfBirth: { type: String },
  bloodGroup: { type: String },
  emergencyContact: { type: String },
  emergencyPhone: { type: String },
  allergies: { type: String },
  medicalNotes: { type: String },
  specialty: { type: String },
}, { timestamps: true });

// Document Schema
const documentSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: String },
  documentType: { type: String, required: true },
  encryptedData: { type: String, required: true },
  quantumKeyId: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Document Access Schema
const documentAccessSchema = new mongoose.Schema({
  documentId: { type: String, required: true },
  grantedBy: { type: String, required: true },
  grantedTo: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  revokedAt: { type: Date },
}, { timestamps: true });

// Access History Schema (Blockchain)
const accessHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  quantumStatus: { type: String },
  documentId: { type: String },
  timestamp: { type: Date, default: Date.now },
  blockHash: { type: String },
  previousHash: { type: String },
}, { timestamps: true });

// Quantum Key Schema
const quantumKeySchema = new mongoose.Schema({
  keyId: { type: String, required: true, unique: true },
  key: { type: String, required: true },
  isCompromised: { type: Boolean, default: false },
  bb84Stats: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['document_shared', 'document_viewed', 'access_granted', 'access_revoked', 'access_request', 'system', 'doctor_suggestion'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Doctor Suggestion Schema
const suggestionSchema = new mongoose.Schema({
  documentId: { type: String, required: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String, required: true },
  doctorSpecialty: { type: String },
  diagnosis: { type: String },
  suggestion: { type: String, required: true },
  prescription: { type: String },
  followUpDate: { type: Date },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Message Schema for Secure Chat
const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  senderType: { type: String, enum: ['patient', 'doctor'], required: true },
  receiverId: { type: String, required: true, index: true },
  receiverName: { type: String, required: true },
  content: { type: String, required: true }, // Encrypted content
  isEncrypted: { type: Boolean, default: true },
  encryptionKeyId: { type: String },
  attachments: [{
    fileName: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
    encryptedData: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Conversation Schema to track chat threads
const conversationSchema = new mongoose.Schema({
  participantIds: [{ type: String, required: true }],
  participantNames: [{ type: String }],
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  lastMessage: { type: String },
  lastMessageAt: { type: Date },
  unreadCount: { type: Map, of: Number, default: {} }, // userId -> unread count
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String, required: true },
  doctorSpecialty: { type: String },
  appointmentDate: { type: Date, required: true, index: true },
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true }, // "09:30"
  duration: { type: Number, default: 30 }, // in minutes
  type: {
    type: String,
    enum: ['in-person', 'video', 'phone'],
    default: 'in-person'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show', 'rescheduled'],
    default: 'scheduled'
  },
  reason: { type: String },
  notes: { type: String },
  patientNotes: { type: String }, // Notes from patient
  doctorNotes: { type: String }, // Notes from doctor (after appointment)
  cancelledBy: { type: String },
  cancelReason: { type: String },
  cancelledAt: { type: Date },
  confirmedAt: { type: Date },
  completedAt: { type: Date },
  reminderSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Doctor Availability Schema
const doctorAvailabilitySchema = new mongoose.Schema({
  doctorId: { type: String, required: true, index: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true }, // "17:00"
  slotDuration: { type: Number, default: 30 }, // in minutes
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

// Create Models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);
const DocumentAccess = mongoose.models.DocumentAccess || mongoose.model('DocumentAccess', documentAccessSchema);
const AccessHistory = mongoose.models.AccessHistory || mongoose.model('AccessHistory', accessHistorySchema);
const QuantumKey = mongoose.models.QuantumKey || mongoose.model('QuantumKey', quantumKeySchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const Suggestion = mongoose.models.Suggestion || mongoose.model('Suggestion', suggestionSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
const DoctorAvailability = mongoose.models.DoctorAvailability || mongoose.model('DoctorAvailability', doctorAvailabilitySchema);

// ============================================
// Zod Validation Schemas
// ============================================

const insertUserSchema = z.object({
  name: z.string().min(1),
  aadhaarNumber: z.string().min(1),
  userType: z.enum(['patient', 'doctor', 'admin']),
  city: z.string().min(1),
  email: z.string().email().optional(),
  firebaseUid: z.string().optional(),
});

const insertDocumentAccessSchema = z.object({
  documentId: z.string().min(1),
  grantedBy: z.string().min(1),
  grantedTo: z.string().min(1),
});

// ============================================
// Exports
// ============================================

export {
  // Mongoose Models
  User,
  Document,
  DocumentAccess,
  AccessHistory,
  QuantumKey,
  Notification,
  Suggestion,
  Message,
  Conversation,
  Appointment,
  DoctorAvailability,
  // Zod Schemas
  insertUserSchema,
  insertDocumentAccessSchema,
};
