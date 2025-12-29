import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectMasterDB } from '../config/db.js';
import { getUserModel } from '../models/User.js';

dotenv.config();

/**
 * Create the first System User
 * Usage: node scripts/createSystemUser.js <username> <password>
 */
const createSystemUser = async () => {
  try {
    const username = process.argv[2];
    const password = process.argv[3];

    if (!username || !password) {
      console.error('Usage: node scripts/createSystemUser.js <username> <password>');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('Password must be at least 8 characters long');
      process.exit(1);
    }

    await connectMasterDB();
    console.log('Connected to master database');

    const User = await getUserModel();

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.error(`User ${username} already exists`);
      process.exit(1);
    }

    // Check if system user already exists
    const existingSystemUser = await User.findOne({ role: 'system' });
    if (existingSystemUser) {
      console.warn(`Warning: A system user already exists (${existingSystemUser.username})`);
      console.warn('You can still create another system user if needed.');
    }

    // Create system user
    const passwordHash = await bcrypt.hash(password, 10);
    const systemUser = new User({
      username,
      passwordHash,
      role: 'system',
      tenantId: null // System users don't have tenantId
    });

    await systemUser.save();

    console.log('\n✅ System User created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Role: system`);
    console.log('\nYou can now log in with these credentials.');
    console.log('System Users are automatically routed to the Multi-Admin Dashboard.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating system user:', error);
    process.exit(1);
  }
};

createSystemUser();


