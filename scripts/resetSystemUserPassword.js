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
 * Reset password for an existing system user
 * Usage: node scripts/resetSystemUserPassword.js <username> [newPassword]
 * If newPassword is not provided, a secure password will be auto-generated
 */
const resetSystemUserPassword = async () => {
  try {
    const username = process.argv[2];
    const providedPassword = process.argv[3];

    if (!username) {
      console.error('Usage: node scripts/resetSystemUserPassword.js <username> [newPassword]');
      console.error('If newPassword is not provided, a secure password will be auto-generated and emailed.');
      process.exit(1);
    }

    // Check for SYSTEM_OWNER_EMAIL (required)
    const systemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL;
    if (!systemOwnerEmail) {
      console.error('❌ Error: SYSTEM_OWNER_EMAIL environment variable is required but not set.');
      console.error('Please set SYSTEM_OWNER_EMAIL in your .env file.');
      process.exit(1);
    }

    await connectMasterDB();
    console.log('Connected to master database');

    const User = await getUserModel();

    // Find the system user
    const user = await User.findOne({ username, role: 'system' });
    if (!user) {
      console.error(`❌ Error: System user "${username}" not found.`);
      console.error('   Make sure the username is correct and the user has role "system".');
      process.exit(1);
    }

    console.log(`\n✅ Found system user: ${username}`);
    console.log(`   Email: ${user.email || 'Not set'}`);

    // Generate password if not provided
    let newPassword = providedPassword;
    let passwordGenerated = false;
    if (!newPassword) {
      newPassword = generateSecurePassword();
      passwordGenerated = true;
      console.log('🔐 Generating secure password...');
    } else {
      if (newPassword.length < 8) {
        console.error('❌ Error: Password must be at least 8 characters long');
        process.exit(1);
      }
    }

    // Update password hash
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    console.log('\n✅ Password reset successfully!');

    // Send email with new credentials
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderUserCreationEmail, renderUserCreationText } = await import('../utils/userCreationEmail.js');
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://duesaccountant.winswardtech.com';
      const loginUrl = `${frontendUrl}/login`;
      const setupLink = `${frontendUrl}/reset-password`;

      console.log('\n📧 Attempting to send email...');
      const emailResult = await sendEmail({
        to: systemOwnerEmail,
        subject: 'System User Password Reset - Dues Accountant',
        html: renderUserCreationEmail({
          username: username,
          email: systemOwnerEmail,
          password: newPassword,
          setupLink: setupLink,
          loginUrl: loginUrl,
          role: 'system'
        }),
        text: renderUserCreationText({
          username: username,
          email: systemOwnerEmail,
          password: newPassword,
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
        console.warn(`\n   Username: ${username}`);
        console.warn(`   New Password: ${newPassword}`);
        console.warn(`   Email: ${systemOwnerEmail}`);
        console.warn(`   Login URL: ${loginUrl}`);
      } else if (emailResult?.ok) {
        console.log(`\n✅ Email sent successfully to: ${systemOwnerEmail}`);
        if (passwordGenerated) {
          console.log('🔑 A secure password has been auto-generated and included in the email.');
        }
        console.log('\n📋 IMPORTANT: Please check your email inbox (and spam folder) for the new password.');
      } else {
        console.warn('\n⚠️  WARNING: Email result unclear. Please verify email configuration.');
        console.warn('New credentials saved below - please send manually if email was not received:');
        console.warn(`\n   Username: ${username}`);
        console.warn(`   New Password: ${newPassword}`);
        console.warn(`   Email: ${systemOwnerEmail}`);
        console.warn(`   Login URL: ${loginUrl}`);
      }

      // ALWAYS display password in console (in case email fails)
      console.log('\n' + '='.repeat(60));
      console.log('🔑 NEW PASSWORD (SAVE THIS SECURELY):');
      console.log('='.repeat(60));
      console.log(`Username: ${username}`);
      console.log(`Password: ${newPassword}`);
      console.log(`Login URL: ${loginUrl}`);
      console.log('='.repeat(60));
      console.log('\n⚠️  IMPORTANT: Save these credentials immediately!');
      console.log('   The password is displayed here in case email was not received.\n');

    } catch (emailError) {
      console.error('\n❌ ERROR: Failed to send email with new password');
      console.error('Error details:', emailError.message);
      if (emailError.stack && process.env.NODE_ENV === 'development') {
        console.error('Stack:', emailError.stack);
      }
      
      // CRITICAL: Always show password if email fails
      console.error('\n' + '='.repeat(60));
      console.error('🔑 NEW PASSWORD (EMAIL FAILED - SAVE THIS):');
      console.error('='.repeat(60));
      console.error(`Username: ${username}`);
      console.error(`Password: ${newPassword}`);
      console.error(`Email: ${systemOwnerEmail}`);
      console.error(`Login URL: ${process.env.FRONTEND_URL || 'https://duesaccountant.winswardtech.com'}/login`);
      console.error('='.repeat(60));
      console.error('\n⚠️  You must manually save and send these credentials!');
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
    console.error('Error resetting password:', error);
    process.exit(1);
  }
};

resetSystemUserPassword();
