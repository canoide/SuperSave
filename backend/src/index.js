import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { seedDatabase } from './config/seed.js';
import User from './models/User.js';

// Route imports
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import adminRoutes from './routes/admin.js';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend integration
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serverless-friendly DB and Seeder connection middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    // Dynamically seed database on first request if it is empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Database empty. Running seed database routine...');
      await seedDatabase();
    }
    next();
  } catch (error) {
    console.error('Database connection / seeding failed during request handling:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Supermarket Optimizer Backend API is running' });
});

// Start DB connection, run seeder, and listen on PORT (only if not on Vercel)
if (!process.env.VERCEL) {
  const startServer = async () => {
    try {
      await connectDB();
      // Only run seeding on boot when empty
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        await seedDatabase();
      }

      app.listen(PORT, () => {
        console.log(`Server is running successfully on port ${PORT}`);
      });
    } catch (error) {
      console.error('Critical failure starting server:', error);
      process.exit(1);
    }
  };

  startServer();
}

export default app;
