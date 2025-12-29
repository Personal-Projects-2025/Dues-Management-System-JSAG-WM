import { getTenantModel } from '../models/Tenant.js';
import { getUserModel } from '../models/User.js';
import { getTenantConnection } from '../utils/connectionManager.js';

/**
 * Get all tenants (super admin only, limited metadata)
 */
export const getAllTenants = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view tenants' });
    }

    const Tenant = await getTenantModel();
    const tenants = await Tenant.find({ deletedAt: null })
      .select('name slug databaseName status createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get tenant by ID (super admin only, limited metadata)
 */
export const getTenantById = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can view tenant details' });
    }

    const Tenant = await getTenantModel();
    const tenant = await Tenant.findById(req.params.id)
      .select('name slug databaseName status config contact createdAt updatedAt');

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update tenant status (activate/deactivate) - super admin only
 */
export const updateTenantStatus = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can update tenant status' });
    }

    const { status } = req.body;
    if (!['active', 'inactive', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const Tenant = await getTenantModel();
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    tenant.status = status;
    if (status === 'archived') {
      tenant.deletedAt = new Date();
    } else {
      tenant.deletedAt = null;
    }
    await tenant.save();

    res.json({
      message: 'Tenant status updated successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        status: tenant.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Soft delete tenant - super admin only
 */
export const deleteTenant = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can delete tenants' });
    }

    const Tenant = await getTenantModel();
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await tenant.softDelete();

    res.json({
      message: 'Tenant deleted successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        status: tenant.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Restore tenant - super admin only
 */
export const restoreTenant = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can restore tenants' });
    }

    const Tenant = await getTenantModel();
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await tenant.restore();

    res.json({
      message: 'Tenant restored successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        status: tenant.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update tenant - System User only
 * Allows updating: name, slug, status, contact info
 */
export const updateTenant = async (req, res) => {
  try {
    if (req.user.role !== 'system') {
      return res.status(403).json({ error: 'Only system users can update tenants' });
    }

    const { name, slug, status, contact } = req.body;
    const Tenant = await getTenantModel();
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Validate slug uniqueness if changed
    if (slug && slug !== tenant.slug) {
      const existingTenant = await Tenant.findOne({ 
        slug: slug.toLowerCase(),
        _id: { $ne: tenant._id },
        deletedAt: null
      });
      if (existingTenant) {
        return res.status(400).json({ error: 'Slug already exists' });
      }
      tenant.slug = slug.toLowerCase();
    }

    // Update allowed fields
    if (name) tenant.name = name;
    if (status && ['active', 'inactive', 'archived'].includes(status)) {
      tenant.status = status;
      if (status === 'archived') {
        tenant.deletedAt = new Date();
      } else {
        tenant.deletedAt = null;
      }
    }
    if (contact) {
      tenant.contact = { ...tenant.contact, ...contact };
    }

    await tenant.save();

    res.json({
      message: 'Tenant updated successfully',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        databaseName: tenant.databaseName,
        status: tenant.status,
        contact: tenant.contact
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

