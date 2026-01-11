import { getTenantModel } from '../models/Tenant.js';
import { getUserModel } from '../models/User.js';

/**
 * Get all pending tenants
 */
export const getPendingTenants = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view pending tenants' });
    }

    const Tenant = await getTenantModel();
    const pendingTenants = await Tenant.find({ 
      status: 'pending',
      deletedAt: null 
    })
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.json(pendingTenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all rejected tenants
 */
export const getRejectedTenants = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view rejected tenants' });
    }

    const Tenant = await getTenantModel();
    const rejectedTenants = await Tenant.find({ 
      status: 'rejected',
      deletedAt: null 
    })
      .populate('createdBy', 'username email')
      .populate('approvedBy', 'username')
      .sort({ updatedAt: -1 });

    res.json(rejectedTenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get tenant details for review
 */
export const getTenantDetails = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view tenant details' });
    }

    const Tenant = await getTenantModel();
    const User = await getUserModel();
    
    const tenant = await Tenant.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('approvedBy', 'username email');

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get admin user for this tenant
    const adminUser = await User.findOne({ 
      tenantId: tenant._id,
      role: 'admin'
    }).select('username email createdAt');

    res.json({
      tenant,
      adminUser
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Approve a tenant
 */
export const approveTenant = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can approve tenants' });
    }

    const Tenant = await getTenantModel();
    const User = await getUserModel();
    
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'pending') {
      return res.status(400).json({ 
        error: `Tenant is not pending. Current status: ${tenant.status}` 
      });
    }

    // Update tenant status
    tenant.status = 'active';
    tenant.approvedAt = new Date();
    tenant.approvedBy = req.user.userId;
    await tenant.save();

    // Get admin user to send approval email
    const adminUser = await User.findOne({ 
      tenantId: tenant._id,
      role: 'admin'
    });

    // Send approval email to organization
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderTenantApprovedEmail, renderTenantApprovedText } = await import('../utils/templates/tenantApprovedEmail.js');
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/login`;
      
      if (adminUser?.email) {
        await sendEmail({
          to: adminUser.email,
          subject: `Your Organization Has Been Approved - ${tenant.name}`,
          html: renderTenantApprovedEmail({
            tenantName: tenant.name,
            adminUsername: adminUser.username,
            loginUrl: loginUrl
          }),
          text: renderTenantApprovedText({
            tenantName: tenant.name,
            adminUsername: adminUser.username,
            loginUrl: loginUrl
          })
        });
      }
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail approval if email fails
    }

    res.json({
      message: 'Tenant approved successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        status: tenant.status,
        approvedAt: tenant.approvedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reject a tenant
 */
export const rejectTenant = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can reject tenants' });
    }

    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Rejection reason is required' 
      });
    }

    const Tenant = await getTenantModel();
    const User = await getUserModel();
    
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'pending') {
      return res.status(400).json({ 
        error: `Tenant is not pending. Current status: ${tenant.status}` 
      });
    }

    // Update tenant status
    tenant.status = 'rejected';
    tenant.rejectionReason = rejectionReason.trim();
    tenant.approvedBy = req.user.userId; // Track who rejected
    await tenant.save();

    // Get admin user to send rejection email
    const adminUser = await User.findOne({ 
      tenantId: tenant._id,
      role: 'admin'
    });

    // Send rejection email to organization
    try {
      const { sendEmail } = await import('../utils/mailer.js');
      const { renderTenantRejectedEmail, renderTenantRejectedText } = await import('../utils/templates/tenantRejectedEmail.js');
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const registrationUrl = `${frontendUrl}/register`;
      const supportEmail = process.env.SUPPORT_EMAIL || process.env.SYSTEM_OWNER_EMAIL;
      
      if (adminUser?.email) {
        await sendEmail({
          to: adminUser.email,
          subject: `Organization Registration Update - ${tenant.name}`,
          html: renderTenantRejectedEmail({
            tenantName: tenant.name,
            adminUsername: adminUser.username,
            rejectionReason: tenant.rejectionReason,
            supportEmail: supportEmail,
            registrationUrl: registrationUrl
          }),
          text: renderTenantRejectedText({
            tenantName: tenant.name,
            adminUsername: adminUser.username,
            rejectionReason: tenant.rejectionReason,
            supportEmail: supportEmail,
            registrationUrl: registrationUrl
          })
        });
      }
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Don't fail rejection if email fails
    }

    res.json({
      message: 'Tenant rejected successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        status: tenant.status,
        rejectionReason: tenant.rejectionReason
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

