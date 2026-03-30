import { useSupabase } from '../config/supabase.js';
import { getTenantModel } from '../models/Tenant.js';
import * as masterDb from '../db/masterDb.js';

/**
 * GET /api/settings
 * Returns the current tenant's configurable settings.
 */
export const getSettings = async (req, res) => {
  try {
    const tenant = req.tenant;
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const cfg = tenant.config || {};
    const settings = cfg.settings || {};
    const branding = cfg.branding || {};

    res.json({
      branding: {
        name: branding.name || '',
        primaryColor: branding.primaryColor || '#3B82F6',
        secondaryColor: branding.secondaryColor || '#1E40AF',
      },
      settings: {
        emailNotifications: settings.emailNotifications ?? true,
        autoReceipts: settings.autoReceipts ?? true,
        reminderEnabled: settings.reminderEnabled ?? true,
        reminderDay: settings.reminderDay ?? 25,
        appreciationEnabled: settings.appreciationEnabled ?? false,
        appreciationDelayMonths: settings.appreciationDelayMonths ?? 3,
      },
    });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ error: error.message || 'Failed to load settings' });
  }
};

/**
 * PATCH /api/settings
 * Updates the tenant's configurable settings.
 * Accepts a flat object — only supplied fields are updated.
 */
export const updateSettings = async (req, res) => {
  try {
    const tenant = req.tenant;
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const {
      reminderEnabled,
      reminderDay,
      appreciationEnabled,
      appreciationDelayMonths,
      emailNotifications,
      autoReceipts,
      brandingName,
    } = req.body;

    // Validate reminderDay
    if (reminderDay !== undefined) {
      const day = Number(reminderDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        return res.status(400).json({ error: 'reminderDay must be an integer between 1 and 28' });
      }
    }

    // Validate appreciationDelayMonths
    if (appreciationDelayMonths !== undefined) {
      const delay = Number(appreciationDelayMonths);
      if (!Number.isInteger(delay) || delay < 3 || delay > 6) {
        return res.status(400).json({ error: 'appreciationDelayMonths must be 3, 4, 5, or 6' });
      }
    }

    if (useSupabase()) {
      const tenantId = req.tenantId;
      const existing = await masterDb.getTenantById(tenantId);
      if (!existing) return res.status(404).json({ error: 'Tenant not found' });

      const existingCfg = existing.config || {};
      const existingSettings = existingCfg.settings || {};
      const existingBranding = existingCfg.branding || {};

      const updatedConfig = {
        ...existingCfg,
        branding: {
          ...existingBranding,
          ...(brandingName !== undefined ? { name: brandingName } : {}),
        },
        settings: {
          ...existingSettings,
          ...(reminderEnabled !== undefined ? { reminderEnabled: Boolean(reminderEnabled) } : {}),
          ...(reminderDay !== undefined ? { reminderDay: Number(reminderDay) } : {}),
          ...(appreciationEnabled !== undefined ? { appreciationEnabled: Boolean(appreciationEnabled) } : {}),
          ...(appreciationDelayMonths !== undefined ? { appreciationDelayMonths: Number(appreciationDelayMonths) } : {}),
          ...(emailNotifications !== undefined ? { emailNotifications: Boolean(emailNotifications) } : {}),
          ...(autoReceipts !== undefined ? { autoReceipts: Boolean(autoReceipts) } : {}),
        },
      };

      await masterDb.updateTenant(tenantId, { config: updatedConfig });
      return res.json({ message: 'Settings updated successfully', config: updatedConfig });
    }

    // MongoDB path
    const existingCfg = tenant.config || {};
    const existingSettings = existingCfg.settings || {};
    const existingBranding = existingCfg.branding || {};

    const updatedSettings = {
      ...existingSettings,
      ...(reminderEnabled !== undefined ? { reminderEnabled: Boolean(reminderEnabled) } : {}),
      ...(reminderDay !== undefined ? { reminderDay: Number(reminderDay) } : {}),
      ...(appreciationEnabled !== undefined ? { appreciationEnabled: Boolean(appreciationEnabled) } : {}),
      ...(appreciationDelayMonths !== undefined ? { appreciationDelayMonths: Number(appreciationDelayMonths) } : {}),
      ...(emailNotifications !== undefined ? { emailNotifications: Boolean(emailNotifications) } : {}),
      ...(autoReceipts !== undefined ? { autoReceipts: Boolean(autoReceipts) } : {}),
    };

    const updatedBranding = {
      ...existingBranding,
      ...(brandingName !== undefined ? { name: brandingName } : {}),
    };

    const Tenant = await getTenantModel();
    const tenantDoc = await Tenant.findById(req.tenantId || tenant._id || tenant.id);
    if (!tenantDoc) return res.status(404).json({ error: 'Tenant not found' });

    tenantDoc.config = { ...existingCfg, settings: updatedSettings, branding: updatedBranding };
    await tenantDoc.save();

    res.json({ message: 'Settings updated successfully', config: tenantDoc.config });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
};
