import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { getUserModel } from '../models/User.js';
import { getTenantModel } from '../models/Tenant.js';
import { useSupabase } from '../config/supabase.js';
import * as masterDb from '../db/masterDb.js';

/**
 * Get all System Users
 */
export const getSystemUsers = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view system users' });
    }

    const User = await getUserModel();
    const systemUsers = await User.find({ role: 'system' })
      .select('username email role lastLogin createdAt')
      .sort({ createdAt: -1 });

    res.json(systemUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all Super Users with their tenant information
 */
export const getSuperUsers = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view super users' });
    }

    const User = await getUserModel();
    const Tenant = await getTenantModel();
    
    const superUsers = await User.find({ role: 'super' })
      .select('username email role tenantId lastLogin createdAt')
      .populate('tenantId', 'name slug')
      .sort({ createdAt: -1 });

    // Format response with tenant info
    const formattedUsers = superUsers.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenant: user.tenantId ? {
        id: user.tenantId._id,
        name: user.tenantId.name,
        slug: user.tenantId.slug
      } : null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }));

    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create System User or Super User
 */
export const createSystemUser = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can create system/super users' });
    }

    const { username, email, password, role, tenantId } = req.body;

    // Validate required fields
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Email is required for system/super user creation
    if (!email) {
      return res.status(400).json({ error: 'Email is required for system and super users' });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate role
    if (!['system', 'super'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "system" or "super"' });
    }

    const User = await getUserModel();
    const Tenant = await getTenantModel();

    // Check for existing username
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check for existing email
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Validate tenant for Super Users
    if (role === 'super') {
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required for Super Users' });
      }
      const tenant = await Tenant.findById(tenantId);
      if (!tenant || tenant.status !== 'active') {
        return res.status(400).json({ error: 'Invalid or inactive tenant' });
      }
    } else if (role === 'system' && tenantId) {
      return res.status(400).json({ error: 'System Users cannot be assigned to a tenant' });
    }

    // Import email utilities
    const { sendEmail } = await import('../utils/mailer.js');
    const { renderUserCreationEmail, renderUserCreationText } = await import('../utils/userCreationEmail.js');

    // Generate password if not provided
    let finalPassword = password;
    if (!finalPassword) {
      finalPassword = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    }

    const passwordHash = await bcrypt.hash(finalPassword, 10);
    
    // Generate password reset token for setup link
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create user
    const user = new User({
      username,
      email: email.toLowerCase(),
      passwordHash,
      role,
      tenantId: role === 'system' ? null : tenantId,
      passwordResetToken: resetToken,
      passwordResetExpires: resetTokenExpires
    });

    await user.save();

    // Send welcome email with credentials and setup link
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://duesaccountant.winswardtech.com';
      const setupLink = `${frontendUrl}/reset-password?token=${resetToken}`;
      const loginUrl = `${frontendUrl}/login`;

      // Determine sender name - system users always use "Dues Accountant"
      // Super users use their tenant name
      let senderName = 'Dues Accountant';
      if (role === 'super' && tenantId) {
        const Tenant = await getTenantModel();
        const tenant = await Tenant.findById(tenantId);
        if (tenant) {
          senderName = tenant.config?.branding?.name || tenant.name || 'Dues Accountant';
        }
      }

      await sendEmail({
        to: user.email,
        subject: 'Welcome to Dues Accountant',
        html: renderUserCreationEmail({
          username: user.username,
          email: user.email,
          password: finalPassword,
          setupLink,
          loginUrl,
          role,
          tenantName: senderName
        }),
        text: renderUserCreationText({
          username: user.username,
          email: user.email,
          password: finalPassword,
          setupLink,
          loginUrl,
          role,
          tenantName: senderName
        }),
        senderName: senderName
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail user creation if email fails
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId || null
      },
      passwordGenerated: !password
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all users belonging to a specific tenant
 */
export const getTenantUsers = async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (useSupabase()) {
      const users = await masterDb.findUsers({ tenantId });
      const filtered = users
        .filter(u => ['admin', 'super'].includes(u.role))
        .map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          lastLogin: u.lastLogin,
          createdAt: u.createdAt
        }));
      return res.json(filtered);
    }

    const User = await getUserModel();
    const users = await User.find({
      tenantId,
      role: { $in: ['admin', 'super'] }
    })
      .select('username email role lastLogin createdAt')
      .sort({ createdAt: 1 });

    res.json(users.map(u => ({
      id: u._id,
      username: u.username,
      email: u.email,
      role: u.role,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Promote / demote a tenant user between admin ↔ super
 */
export const updateTenantUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'super'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "admin" or "super"' });
    }

    if (useSupabase()) {
      const users = await masterDb.findUsers({});
      const target = users.find(u => u.id === userId || u.id === Number(userId));
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (!['admin', 'super'].includes(target.role)) {
        return res.status(400).json({ error: 'Can only manage admin/super users through this endpoint' });
      }
      await masterDb.updateUser(target.id, { role });
      return res.json({ message: 'Role updated successfully', userId: target.id, role });
    }

    const User = await getUserModel();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!['admin', 'super'].includes(user.role)) {
      return res.status(400).json({ error: 'Can only manage admin/super users through this endpoint' });
    }

    user.role = role;
    await user.save();

    res.json({ message: 'Role updated successfully', userId: user._id, role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

