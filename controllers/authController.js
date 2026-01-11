import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUserModel } from '../models/User.js';
import { getTenantModel } from '../models/Tenant.js';

export const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required' });
    }

    const User = await getUserModel();
    
    // Determine if input is email or username
    const isEmail = loginIdentifier.includes('@');
    let user;
    
    if (isEmail) {
      // Try to find by email
      user = await User.findOne({ email: loginIdentifier.toLowerCase() });
    } else {
      // Find by username
      user = await User.findOne({ username: loginIdentifier });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Get tenant information if user has a tenant
    let tenant = null;
    if (user.tenantId) {
      const Tenant = await getTenantModel();
      tenant = await Tenant.findById(user.tenantId);
      
      // Handle different tenant statuses
      if (!tenant || tenant.deletedAt) {
        return res.status(403).json({ 
          error: 'Your account is associated with an inactive tenant' 
        });
      }
      
      if (tenant.status === 'rejected') {
        return res.status(403).json({ 
          error: 'Your organization registration has been rejected',
          rejectionReason: tenant.rejectionReason || 'No reason provided'
        });
      }
      
      if (tenant.status === 'pending') {
        // Allow login for pending tenants (they have read-only access)
        // Status will be checked in tenantMiddleware
      } else if (tenant.status !== 'active') {
        return res.status(403).json({ 
          error: 'Your account is associated with an inactive tenant',
          status: tenant.status
        });
      }
    }

    // Create JWT with tenant ID
    // System Users don't have tenantId (they're above all tenants)
    const tokenPayload = {
      userId: user._id,
      username: user.username,
      role: user.role,
      tenantId: user.role === 'system' ? null : (user.tenantId || null)
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email || null,
        role: user.role,
        tenantId: user.role === 'system' ? null : (user.tenantId || null)
      },
      tenant: user.role === 'system' ? null : (tenant ? {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      } : null),
      isSystemUser: user.role === 'system'
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: error.message || 'Request failed' });
  }
};

export const register = async (req, res) => {
  try {
    const { username, email, password, role, tenantId } = req.body;
    const requesterRole = req.user?.role;
    const requesterTenantId = req.user?.tenantId;
    
    // Debug logging
    console.log('Register request:', {
      username,
      email,
      role,
      tenantId,
      requesterRole,
      requesterTenantId,
      jwtTenantId: req.user?.tenantId,
      userId: req.user?.userId
    });

    // Only system users can create system users
    // System users and super users can create tenant-bound users
    if (role === 'system' && requesterRole !== 'system') {
      return res.status(403).json({ error: 'Only system users can create system user accounts' });
    }

    if (role !== 'system' && requesterRole !== 'system' && requesterRole !== 'super') {
      return res.status(403).json({ error: 'Only system users or super users can create accounts' });
    }

    // Email is required for super/admin role creation
    const userRole = role || 'admin';
    if ((userRole === 'super' || userRole === 'admin') && !email) {
      return res.status(400).json({ error: 'Email is required for super admin and admin users' });
    }

    // Auto-assign tenantId: If requester is a super user, use their tenantId
    // Handle cases where tenantId might be null, undefined, or empty string
    let finalTenantId = tenantId || null;
    if (requesterRole === 'super') {
      // If tenantId is not provided (null, undefined, or empty), use requester's tenantId
      if (!finalTenantId && requesterTenantId) {
        finalTenantId = requesterTenantId;
      }
      // If still no tenantId, we need to fetch it from the database
      if (!finalTenantId) {
        try {
          const User = await getUserModel();
          const requesterUser = await User.findById(req.user.userId);
          if (requesterUser && requesterUser.tenantId) {
            finalTenantId = requesterUser.tenantId.toString();
          }
        } catch (dbError) {
          console.error('Error fetching requester tenantId:', dbError);
        }
      }
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const User = await getUserModel();
    
    // Check for existing username
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check for existing email (only if email is provided)
    if (email) {
      const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingUserByEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Tenant validation based on role (userRole already set above)
    
    if (userRole === 'system') {
      // System users must not have tenantId
      if (finalTenantId) {
        return res.status(400).json({ error: 'System users cannot be assigned to a tenant' });
      }
    } else if (userRole === 'super') {
      // Super users must have tenantId
      if (!finalTenantId) {
        return res.status(400).json({ error: 'Super users must be assigned to a tenant' });
      }
      const Tenant = await getTenantModel();
      const tenant = await Tenant.findById(finalTenantId);
      if (!tenant || tenant.status !== 'active') {
        return res.status(400).json({ error: 'Invalid or inactive tenant' });
      }
    } else if (userRole === 'admin') {
      // Admins must have tenantId (System Users cannot create admins directly)
      if (!finalTenantId) {
        console.error('Admin user creation failed - no tenantId:', {
          tenantId,
          requesterTenantId,
          finalTenantId,
          requesterRole
        });
        return res.status(400).json({ 
          error: 'Admins must be assigned to a tenant. Please ensure you are logged in as a super user with a valid tenant.' 
        });
      }
      const Tenant = await getTenantModel();
      const tenant = await Tenant.findById(finalTenantId);
      if (!tenant || tenant.status !== 'active') {
        return res.status(400).json({ error: 'Invalid or inactive tenant' });
      }
    }

    // Generate password if not provided
    let finalPassword = password;
    if (!finalPassword) {
      const { randomBytes } = await import('crypto');
      finalPassword = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    }

    const passwordHash = await bcrypt.hash(finalPassword, 10);
    
    // Generate password reset token for setup link
    const { randomBytes } = await import('crypto');
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // System users don't have tenantId
    const user = new User({
      username,
      email: email ? email.toLowerCase() : null,
      passwordHash,
      role: userRole,
      tenantId: userRole === 'system' ? null : finalTenantId,
      passwordResetToken: resetToken,
      passwordResetExpires: resetTokenExpires
    });

    await user.save();

    // Send welcome email with credentials and setup link
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderUserCreationEmail, renderUserCreationText } = await import('../utils/userCreationEmail.js');
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const setupLink = `${frontendUrl}/reset-password?token=${resetToken}`;
      const loginUrl = `${frontendUrl}/login`;

      // Determine sender name based on tenant context
      let senderName = 'Dues Accountant'; // Default for system users
      if (finalTenantId && userRole !== 'system') {
        const Tenant = await getTenantModel();
        const tenant = await Tenant.findById(finalTenantId);
        if (tenant) {
          senderName = tenant.config?.branding?.name || tenant.name || 'Dues Accountant';
        }
      }

      // Only send email if email is provided
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: 'Welcome to Dues Accountant',
          html: renderUserCreationEmail({
            username: user.username,
            email: user.email,
            password: finalPassword,
            setupLink,
            loginUrl,
            role: userRole
          }),
          text: renderUserCreationText({
            username: user.username,
            email: user.email,
            password: finalPassword,
            setupLink,
            loginUrl,
            role: userRole
          }),
          senderName: senderName
        });
      }
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail user creation if email fails
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email || null,
        role: user.role,
        tenantId: user.tenantId || null
      },
      passwordGenerated: !password // Indicate if password was auto-generated
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: error.message || 'Request failed' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const User = await getUserModel();
    const user = await User.findById(req.user.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tenant info if user has a tenant
    let tenant = null;
    if (user.tenantId) {
      const Tenant = await getTenantModel();
      tenant = await Tenant.findById(user.tenantId).select('name slug status');
    }

    // If user doesn't have tenantId but is not a system user, try to assign to demo tenant
    if (!user.tenantId && user.role !== 'system') {
      const Tenant = await getTenantModel();
      const demoTenantName = process.env.DEFAULT_TENANT_NAME || 'demo';
      let demoTenant = await Tenant.findOne({ 
        slug: demoTenantName,
        deletedAt: null 
      });

      if (demoTenant) {
        user.tenantId = demoTenant._id;
        await user.save();
        tenant = await Tenant.findById(demoTenant._id).select('name slug status');
      }
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email || null,
      role: user.role,
      tenantId: user.role === 'system' ? null : (user.tenantId || null),
      lastLogin: user.lastLogin,
      tenant: user.role === 'system' ? null : (tenant ? {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      } : null),
      isSystemUser: user.role === 'system'
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: error.message || 'Request failed' });
  }
};

/**
 * Refresh JWT token with updated tenant information
 * Useful when tenantId is assigned after login
 */
export const refreshToken = async (req, res) => {
  try {
    const User = await getUserModel();
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tenant information
    let tenant = null;
    if (user.tenantId && user.role !== 'system') {
      const Tenant = await getTenantModel();
      tenant = await Tenant.findById(user.tenantId);
      
      if (!tenant || tenant.deletedAt) {
        return res.status(403).json({ 
          error: 'Your account is associated with an inactive tenant' 
        });
      }
      
      if (tenant.status === 'rejected') {
        return res.status(403).json({ 
          error: 'Your organization registration has been rejected',
          rejectionReason: tenant.rejectionReason || 'No reason provided'
        });
      }
      
      if (tenant.status !== 'active' && tenant.status !== 'pending') {
        return res.status(403).json({ 
          error: 'Your account is associated with an inactive tenant',
          status: tenant.status
        });
      }
    }

    // Create new JWT with updated tenant ID
    const tokenPayload = {
      userId: user._id,
      username: user.username,
      role: user.role,
      tenantId: user.role === 'system' ? null : (user.tenantId || null)
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email || null,
        role: user.role,
        tenantId: user.role === 'system' ? null : (user.tenantId || null)
      },
      tenant: user.role === 'system' ? null : (tenant ? {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      } : null),
      isSystemUser: user.role === 'system'
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: error.message || 'Request failed' });
  }
};

