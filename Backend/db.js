import 'dotenv/config';
import mongoose from 'mongoose';

// MongoDB connection setup
const connectDB = async () => {
  try {
    // Use DATABASE_URL (converted to MongoDB format) or fallback to local MongoDB
    let mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical_docs';
    
    // If DATABASE_URL is provided (PostgreSQL format), we'll use a MongoDB cloud service instead
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
      // For demo purposes, use a local MongoDB or MongoDB Atlas
      mongoURI = 'mongodb://localhost:27017/medical_docs';
      console.log('Note: Converted from PostgreSQL to MongoDB. Using local MongoDB.');
    }
    
    // Set connection timeout to prevent hanging
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.warn('Server will continue to start, but database operations may fail.');
    console.warn('To fix this, make sure MongoDB is running or set MONGODB_URI environment variable.');
    // Don't exit - let the server start anyway
    return null;
  }
};

// Initialize connection (non-blocking)
console.log('Starting database connection (non-blocking)...');
connectDB().catch(err => {
  console.error('Failed to initialize database connection:', err);
});
console.log('Database connection initiated (will connect in background)');

export { mongoose, connectDB };