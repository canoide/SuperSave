import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

export const connectDB = async () => {
  // If already connected, use the active connection
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    let mongoUri = process.env.MONGO_URI;

    // Do not attempt to start in-memory Mongo on Vercel
    if (!mongoUri && !process.env.VERCEL) {
      console.log('No MONGO_URI provided. Starting in-memory MongoDB server...');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`In-memory MongoDB server started at: ${mongoUri}`);
    }

    if (!mongoUri) {
      throw new Error('Database connection string (MONGO_URI) is required in this environment.');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    // On serverless, don't kill the entire process if it's a transient connection failure, but re-throw
    if (process.env.VERCEL) {
      throw error;
    } else {
      process.exit(1);
    }
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('MongoDB disconnected successfully.');
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
};
