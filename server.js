import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import connectDB, { connectMasterDB } from './config/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import logRoutes from './routes/logRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import expenditureRoutes from './routes/expenditureRoutes.js';
import subgroupRoutes from './routes/subgroupRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import tenantSetupRoutes from './routes/tenantSetupRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import { initReminderScheduler } from './jobs/reminderScheduler.js';
import { migrateToDemoTenant } from './scripts/migrateToTenant.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS Configuration with origin whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : NODE_ENV === 'production'
  ? [] // Must be set in production
  : ['http://localhost:3000', 'http://localhost:3001']; // Default dev origins

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Connect to Master MongoDB (for tenant metadata and users)
const initializeServer = async () => {
  try {
    await connectMasterDB();
    if (NODE_ENV === 'development') {
      console.log('Master database connected');
    }

    // Auto-migrate existing data to demo tenant on first startup
    if (process.env.AUTO_MIGRATE === 'true') {
      try {
        await migrateToDemoTenant();
        // Also assign all existing users to demo tenant
        const { assignUsersToDemoTenant } = await import('./scripts/assignUsersToDemoTenant.js');
        await assignUsersToDemoTenant();
      } catch (error) {
        if (NODE_ENV === 'development') {
          console.error('Migration error (non-fatal):', error.message);
        }
      }
    }

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/members', memberRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/logs', logRoutes);
    app.use('/api/receipts', receiptRoutes);
    app.use('/api/expenditure', expenditureRoutes);
    app.use('/api/subgroups', subgroupRoutes);
    app.use('/api/reminders', reminderRoutes);
    app.use('/api/tenants', tenantRoutes);
    app.use('/api/tenant-setup', tenantSetupRoutes);
    app.use('/api/system', systemRoutes);

    // Initialize reminder scheduler
    initReminderScheduler();

    // Start server
    app.listen(PORT, () => {
      if (NODE_ENV === 'development') {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${NODE_ENV}`);
      }
    });
  } catch (error) {
    console.error('Failed to initialize server:', error.message);
    if (NODE_ENV === 'development') {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
};

// Health check (before routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  if (NODE_ENV === 'development') {
    console.error('Error:', err);
    console.error('Stack:', err.stack);
  } else {
    // In production, log without sensitive details
    console.error('Error:', err.message);
  }

  // Don't expose stack traces in production
  const errorResponse = {
    error: NODE_ENV === 'production' 
      ? 'An error occurred. Please try again later.' 
      : err.message || 'Something went wrong!',
  };

  // Include stack trace only in development
  if (NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Set status code
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json(errorResponse);
});

// Legacy connectDB for backward compatibility (runs in parallel)
connectDB().catch((error) => {
  if (NODE_ENV === 'development') {
    console.error('Legacy DB connection error:', error);
  }
});

// Initialize server
initializeServer();

