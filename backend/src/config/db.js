import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

export const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;

    // In a sandbox environment or without MONGO_URI, boot mongodb-memory-server
    if (!mongoUri) {
      console.log('No MONGO_URI provided. Starting in-memory MongoDB server...');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`In-memory MongoDB server started at: ${mongoUri}`);
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
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
