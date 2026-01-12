import dotenv from 'dotenv';
import { connectMasterDB } from '../config/db.js';
import { getUserModel } from '../models/User.js';

dotenv.config();

/**
 * Get system user information
 * Usage: node scripts/getSystemUserInfo.js [username]
 */
const getSystemUserInfo = async () => {
  try {
    await connectMasterDB();
    console.log('Connected to master database');

    const User = await getUserModel();
    const username = process.argv[2];

    if (username) {
      // Get specific user
      const user = await User.findOne({ username, role: 'system' });
      if (!user) {
        console.error(`❌ System user "${username}" not found`);
        process.exit(1);
      }
      
      console.log('\n✅ System User Found:');
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email || 'Not set'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Last Login: ${user.lastLogin || 'Never'}`);
      console.log('\n⚠️  Note: Passwords are hashed and cannot be retrieved.');
      console.log('   You will need to reset the password or create a new system user.');
    } else {
      // List all system users
      const systemUsers = await User.find({ role: 'system' });
      if (systemUsers.length === 0) {
        console.log('No system users found.');
        process.exit(0);
      }
      
      console.log(`\n📋 Found ${systemUsers.length} system user(s):\n`);
      systemUsers.forEach((user, index) => {
        console.log(`${index + 1}. Username: ${user.username}`);
        console.log(`   Email: ${user.email || 'Not set'}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   Last Login: ${user.lastLogin || 'Never'}\n`);
      });
      
      console.log('⚠️  Note: Passwords are hashed and cannot be retrieved.');
      console.log('   To reset password, you can create a new system user or implement password reset.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

getSystemUserInfo();
