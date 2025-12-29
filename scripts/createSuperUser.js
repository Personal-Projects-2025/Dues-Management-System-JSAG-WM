import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { connectMasterDB } from '../config/db.js';
import { getUserModel } from '../models/User.js';

dotenv.config();

const createSuperUser = async () => {
  try {
    await connectMasterDB();
    console.log('Connected to master database');

    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'admin123';
    const role = 'super';

    const User = await getUserModel();

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log(`User ${username} already exists!`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (super users need tenantId - will be assigned to demo tenant)
    const user = new User({
      username,
      passwordHash,
      role,
      tenantId: null // Will be assigned to demo tenant by middleware
    });

    await user.save();
    console.log(`Super user created successfully!`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}`);
    console.log(`\nNote: This user will be assigned to Demo Tenant on first login.`);

    process.exit(0);
  } catch (error) {
    console.error('Error creating super user:', error);
    process.exit(1);
  }
};

createSuperUser();

