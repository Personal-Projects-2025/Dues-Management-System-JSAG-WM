import bcrypt from 'bcrypt';
import { getTenantModel } from '../models/Tenant.js';
import { getUserModel } from '../models/User.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { initializeTenantSchema } from '../scripts/initializeTenantSchema.js';

/**
 * Register a new tenant (self-service or super admin)
 */
export const registerTenant = async (req, res) => {
  try {
    const {
      name,
      slug,
      databaseName,
      adminUsername,
      adminPassword,
      adminEmail,
      contactEmail,
      contactPhone,
      branding
    } = req.body;

    // Validation
    if (!name || !slug || !databaseName || !adminUsername || !adminPassword) {
      return res.status(400).json({
        error: 'Name, slug, database name, admin username, and password are required'
      });
    }

    // Validate database name format
    if (!/^[a-z0-9_-]+$/.test(databaseName)) {
      return res.status(400).json({
        error: 'Database name can only contain lowercase letters, numbers, underscores, and hyphens'
      });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        error: 'Slug can only contain lowercase letters, numbers, and hyphens'
      });
    }

    const Tenant = await getTenantModel();
    const User = await getUserModel();

    // Check if slug or database name already exists
    const existingTenant = await Tenant.findOne({
      $or: [
        { slug },
        { databaseName }
      ],
      deletedAt: null
    });

    if (existingTenant) {
      return res.status(400).json({
        error: 'A tenant with this slug or database name already exists'
      });
    }

    // Check if admin username already exists (before creating tenant)
    const existingUser = await User.findOne({
      $or: [
        { username: adminUsername },
        ...(adminEmail ? [{ email: adminEmail.toLowerCase() }] : [])
      ]
    });

    if (existingUser) {
      if (existingUser.username === adminUsername) {
        return res.status(400).json({
          error: 'Admin username already exists. Please choose a different username.'
        });
      }
      if (adminEmail && existingUser.email === adminEmail.toLowerCase()) {
        return res.status(400).json({
          error: 'Admin email already exists. Please use a different email address.'
        });
      }
    }

    // Check if database already exists by trying to connect
    try {
      const testConn = await getTenantConnection(databaseName);
      // If connection succeeds, database might exist
      const collections = await testConn.db.listCollections().toArray();
      if (collections.length > 0) {
        return res.status(400).json({
          error: 'Database name already exists and contains data'
        });
      }
    } catch (error) {
      // Database doesn't exist, which is good
    }

    // Create tenant record with pending status
    const tenant = new Tenant({
      name,
      slug,
      databaseName,
      status: 'pending',
      config: {
        branding: {
          name: branding?.name || name,
          logo: branding?.logo || '',
          primaryColor: branding?.primaryColor || '#3B82F6',
          secondaryColor: branding?.secondaryColor || '#1E40AF'
        },
        settings: {
          emailNotifications: true,
          autoReceipts: true,
          reminderEnabled: true
        },
        features: {
          subgroups: true,
          expenditure: true,
          reports: true
        }
      },
      contact: {
        email: contactEmail || '',
        phone: contactPhone || '',
        address: ''
      },
      createdBy: req.user?.userId || null
    });

    await tenant.save();

    // Initialize tenant database schema
    try {
      await initializeTenantSchema(databaseName);
    } catch (error) {
      // If schema initialization fails, delete tenant record
      await Tenant.findByIdAndDelete(tenant._id);
      return res.status(500).json({
        error: 'Failed to initialize tenant database',
        details: error.message
      });
    }

    // Create admin user in master database
    let adminUser = null;
    try {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      // Generate password reset token for admin user
      const { randomBytes } = await import('crypto');
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      adminUser = new User({
        username: adminUsername,
        email: adminEmail ? adminEmail.toLowerCase() : null,
        passwordHash,
        role: 'admin',
        tenantId: tenant._id,
        passwordResetToken: resetToken,
        passwordResetExpires: resetTokenExpires
      });

      await adminUser.save();
    } catch (userError) {
      // If admin user creation fails, clean up the tenant and database
      try {
        await Tenant.findByIdAndDelete(tenant._id);
      } catch (deleteError) {
        console.error('Failed to delete tenant after user creation error:', deleteError);
      }
      
      // Handle duplicate username/email error
      if (userError.code === 11000) {
        const errorField = userError.keyPattern?.username ? 'username' : 'email';
        return res.status(400).json({
          error: `Admin ${errorField} already exists. Please choose a different ${errorField}.`
        });
      }
      
      // Re-throw other errors
      throw userError;
    }

    // Send confirmation email to registrant(s)
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderTenantRegistrationConfirmationEmail, renderTenantRegistrationConfirmationText } = await import('../utils/templates/tenantRegistrationConfirmationEmail.js');
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/login`;
      const supportEmail = process.env.SUPPORT_EMAIL || process.env.SYSTEM_OWNER_EMAIL;
      
      // Prepare email parameters
      const emailParams = {
        tenantName: tenant.name,
        adminUsername: adminUsername,
        adminEmail: adminEmail,
        adminPassword: adminPassword, // Include password in confirmation email
        supportEmail: supportEmail,
        loginUrl: loginUrl
      };

      // Send to admin email if provided
      if (adminEmail) {
        await sendEmail({
          to: adminEmail.toLowerCase(),
          subject: `Registration Confirmation - ${tenant.name}`,
          html: renderTenantRegistrationConfirmationEmail(emailParams),
          text: renderTenantRegistrationConfirmationText(emailParams)
        });
      }

      // Send to contact email if it exists and is different from admin email
      if (contactEmail && contactEmail.toLowerCase() !== adminEmail?.toLowerCase()) {
        await sendEmail({
          to: contactEmail.toLowerCase(),
          subject: `Registration Confirmation - ${tenant.name}`,
          html: renderTenantRegistrationConfirmationEmail(emailParams),
          text: renderTenantRegistrationConfirmationText(emailParams)
        });
      }
    } catch (emailError) {
      console.error('Failed to send registration confirmation email:', emailError);
      // Don't fail tenant creation if email fails
    }

    // Send notification email to system owner
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderTenantApprovalEmail, renderTenantApprovalText } = await import('../utils/templates/tenantApprovalEmail.js');
      
      const systemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardUrl = `${frontendUrl}/tenant-approval`;
      
      if (systemOwnerEmail) {
        await sendEmail({
          to: systemOwnerEmail,
          subject: `New Organization Registration: ${tenant.name}`,
          html: renderTenantApprovalEmail({
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            adminUsername: adminUsername,
            adminEmail: adminEmail,
            contactEmail: contactEmail,
            contactPhone: contactPhone,
            registrationDate: tenant.createdAt,
            dashboardUrl: dashboardUrl
          }),
          text: renderTenantApprovalText({
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            adminUsername: adminUsername,
            adminEmail: adminEmail,
            contactEmail: contactEmail,
            contactPhone: contactPhone,
            registrationDate: tenant.createdAt,
            dashboardUrl: dashboardUrl
          })
        });
      } else {
        console.warn('SYSTEM_OWNER_EMAIL not configured. Skipping notification email.');
      }
    } catch (emailError) {
      console.error('Failed to send tenant approval notification email:', emailError);
      // Don't fail tenant creation if email fails
    }

    res.status(201).json({
      message: 'Tenant registration submitted successfully. Your organization is pending approval.',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        databaseName: tenant.databaseName,
        status: tenant.status
      },
      adminUser: {
        id: adminUser._id,
        username: adminUser.username
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Tenant slug or database name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get tenant setup status
 */
export const getSetupStatus = async (req, res) => {
  try {
    const { slug } = req.params;
    const Tenant = await getTenantModel();
    const tenant = await Tenant.findOne({ slug, deletedAt: null });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Check if database is initialized
    let dbInitialized = false;
    try {
      const conn = await getTenantConnection(tenant.databaseName);
      const collections = await conn.db.listCollections().toArray();
      dbInitialized = collections.length > 0;
    } catch (error) {
      dbInitialized = false;
    }

    res.json({
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      },
      setup: {
        databaseInitialized: dbInitialized,
        completed: dbInitialized && tenant.status === 'active'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

