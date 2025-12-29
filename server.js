import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Master MongoDB (for tenant metadata and users)
const initializeServer = async () => {
  try {
    await connectMasterDB();
    console.log('Master database connected');

    // Auto-migrate existing data to demo tenant on first startup
    if (process.env.AUTO_MIGRATE === 'true') {
      try {
        await migrateToDemoTenant();
        // Also assign all existing users to demo tenant
        const { assignUsersToDemoTenant } = await import('./scripts/assignUsersToDemoTenant.js');
        await assignUsersToDemoTenant();
      } catch (error) {
        console.error('Migration error (non-fatal):', error.message);
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
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

// Health check (before routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Legacy connectDB for backward compatibility (runs in parallel)
connectDB().catch(console.error);

// Initialize server
initializeServer();

