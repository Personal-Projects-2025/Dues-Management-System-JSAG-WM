import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { connectMasterDB } from '../config/db.js';
import { getUserModel } from '../models/User.js';

dotenv.config();

/**
 * Generate a secure random password
 * @returns {string} Secure password
 */
const generateSecurePassword = () => {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
};

/**
 * Create the first System User
 * Usage: node scripts/createSystemUser.js <username> [password]
 * If password is not provided, a secure password will be auto-generated
 */
const createSystemUser = async () => {
  try {
    const username = process.argv[2];
    const providedPassword = process.argv[3];

    if (!username) {
      console.error('Usage: node scripts/createSystemUser.js <username> [password]');
      console.error('If password is not provided, a secure password will be auto-generated and emailed.');
      process.exit(1);
    }

    // Check for SYSTEM_OWNER_EMAIL (required)
    const systemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL;
    if (!systemOwnerEmail) {
      console.error('❌ Error: SYSTEM_OWNER_EMAIL environment variable is required but not set.');
      console.error('Please set SYSTEM_OWNER_EMAIL in your .env file.');
      process.exit(1);
    }

    // Generate password if not provided
    let password = providedPassword;
    let passwordGenerated = false;
    if (!password) {
      password = generateSecurePassword();
      passwordGenerated = true;
      console.log('🔐 Generating secure password...');
    } else {
      if (password.length < 8) {
        console.error('❌ Error: Password must be at least 8 characters long');
        process.exit(1);
      }
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
      email: systemOwnerEmail,
      passwordHash,
      role: 'system',
      tenantId: null // System users don't have tenantId
    });

    await systemUser.save();

    console.log('\n✅ System User created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Role: system`);

    // Send email with credentials
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderUserCreationEmail, renderUserCreationText } = await import('../utils/userCreationEmail.js');
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://duesaccountant.winswardtech.com';
      const loginUrl = `${frontendUrl}/login`;
      
      // For system users, we don't need a setup link (they can change password after login)
      // But we'll provide a placeholder to avoid template errors
      const setupLink = `${frontendUrl}/reset-password`;

      console.log('\n📧 Attempting to send email...');
      const emailResult = await sendEmail({
        to: systemOwnerEmail,
        subject: 'System User Account Created - Dues Accountant',
        html: renderUserCreationEmail({
          username: username,
          email: systemOwnerEmail,
          password: password,
          setupLink: setupLink,
          loginUrl: loginUrl,
          role: 'system'
        }),
        text: renderUserCreationText({
          username: username,
          email: systemOwnerEmail,
          password: password,
          setupLink: setupLink,
          loginUrl: loginUrl,
          role: 'system'
        }),
        senderName: 'Dues Accountant'
      });

      // Check if email was actually sent or skipped
      if (emailResult?.skipped) {
        console.warn('\n⚠️  WARNING: Email sending is disabled (EMAIL_ENABLED=false)');
        console.warn('Email was NOT sent. Please save these credentials manually:');
      } else if (emailResult?.ok) {
        console.log(`\n✅ Email sent successfully to: ${systemOwnerEmail}`);
        if (passwordGenerated) {
          console.log('🔑 A secure password has been auto-generated and included in the email.');
        }
        console.log('\n📋 IMPORTANT: Please check your email inbox (and spam folder) for the credentials.');
      } else {
        console.warn('\n⚠️  WARNING: Email result unclear. Please verify email configuration.');
        console.warn('Credentials saved below - please send manually if email was not received:');
      }

      // ALWAYS display password in console as backup (in case email fails or is not received)
      console.log('\n' + '='.repeat(60));
      console.log('🔑 LOGIN CREDENTIALS (SAVE THIS SECURELY):');
      console.log('='.repeat(60));
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
      console.log(`Email: ${systemOwnerEmail}`);
      console.log(`Login URL: ${loginUrl}`);
      console.log('='.repeat(60));
      console.log('\n⚠️  IMPORTANT: Save these credentials immediately!');
      console.log('   The password is displayed here in case email was not received.\n');
    } catch (emailError) {
      console.error('\n❌ ERROR: Failed to send email with credentials');
      console.error('Error details:', emailError.message);
      if (emailError.stack && process.env.NODE_ENV === 'development') {
        console.error('Stack:', emailError.stack);
      }
      console.error('\n⚠️  IMPORTANT: User was created but email failed. Please save these credentials:');
      console.error(`\n   Username: ${username}`);
      console.error(`   Password: ${password}`);
      console.error(`   Email: ${systemOwnerEmail}`);
      console.error(`   Login URL: ${process.env.FRONTEND_URL || 'https://duesaccountant.winswardtech.com'}/login`);
      console.error('\n⚠️  You may need to manually send the credentials to the system owner.');
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check EMAIL_ENABLED in .env (should be "true")');
      console.error('   2. Verify BREVO_API_KEY or SMTP configuration');
      console.error('   3. Check EMAIL_FROM_ADDRESS is set correctly');
      console.error('   4. Verify email service is working');
    }

    console.log('\n📍 Login URL:', `${process.env.FRONTEND_URL || 'https://duesaccountant.winswardtech.com'}/login`);
    console.log('System Users are automatically routed to the Multi-Admin Dashboard.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating system user:', error);
    process.exit(1);
  }
};

createSystemUser();


