import { useSupabase } from '../config/supabase.js';
import { getTenantModel } from '../models/Tenant.js';
import { syncBrandingNameWithTenantName } from '../utils/tenantDisplayName.js';
import * as masterDb from '../db/masterDb.js';

const SMS_FIELD_MAX = 100;

const trimSmsField = (value, maxLen = SMS_FIELD_MAX) => {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().slice(0, maxLen);
};

const buildPaymentSettingsPatch = (body) => {
  const patch = {};
  if (body.paymentMethod !== undefined) patch.paymentMethod = trimSmsField(body.paymentMethod) || '';
  if (body.paymentAccount !== undefined) patch.paymentAccount = trimSmsField(body.paymentAccount) || '';
  if (body.paymentAccountName !== undefined) patch.paymentAccountName = trimSmsField(body.paymentAccountName) || '';
  if (body.paymentReference !== undefined) {
    patch.paymentReference = trimSmsField(body.paymentReference, 50) || 'Dues';
  }
  if (body.closingBlessing !== undefined) {
    patch.closingBlessing = trimSmsField(body.closingBlessing, 150) || 'God bless you.';
  }
  return patch;
};

const validateSmsPaymentSettings = (settings) => {
  if (settings.smsNotifications !== true) return null;
  if (!String(settings.paymentMethod || '').trim()) {
    return 'Payment method is required when SMS reminders are enabled';
  }
  if (!String(settings.paymentAccount || '').trim()) {
    return 'Payment account is required when SMS reminders are enabled';
  }
  return null;
};

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
        smsNotifications: settings.smsNotifications ?? true,
        autoReceipts: settings.autoReceipts ?? true,
        reminderEnabled: settings.reminderEnabled ?? true,
        reminderDay: settings.reminderDay ?? 25,
        paymentMethod: settings.paymentMethod ?? '',
        paymentAccount: settings.paymentAccount ?? '',
        paymentAccountName: settings.paymentAccountName ?? '',
        paymentReference: settings.paymentReference ?? 'Dues',
        closingBlessing: settings.closingBlessing ?? 'God bless you.',
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
      smsNotifications,
      autoReceipts,
      brandingName,
      paymentMethod,
      paymentAccount,
      paymentAccountName,
      paymentReference,
      closingBlessing,
    } = req.body;

    const paymentPatch = buildPaymentSettingsPatch({
      paymentMethod,
      paymentAccount,
      paymentAccountName,
      paymentReference,
      closingBlessing,
    });

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

      const mergedSettings = {
        ...existingSettings,
        ...(reminderEnabled !== undefined ? { reminderEnabled: Boolean(reminderEnabled) } : {}),
        ...(reminderDay !== undefined ? { reminderDay: Number(reminderDay) } : {}),
        ...(appreciationEnabled !== undefined ? { appreciationEnabled: Boolean(appreciationEnabled) } : {}),
        ...(appreciationDelayMonths !== undefined ? { appreciationDelayMonths: Number(appreciationDelayMonths) } : {}),
        ...(emailNotifications !== undefined ? { emailNotifications: Boolean(emailNotifications) } : {}),
        ...(smsNotifications !== undefined ? { smsNotifications: Boolean(smsNotifications) } : {}),
        ...(autoReceipts !== undefined ? { autoReceipts: Boolean(autoReceipts) } : {}),
        ...paymentPatch,
      };

      const smsValidationError = validateSmsPaymentSettings(mergedSettings);
      if (smsValidationError) {
        return res.status(400).json({ error: smsValidationError });
      }

      const updatedConfig = {
        ...existingCfg,
        branding: {
          ...existingBranding,
          ...(brandingName !== undefined ? { name: String(brandingName).trim() } : {}),
        },
        settings: mergedSettings,
      };

      const tenantUpdates = { config: updatedConfig };
      if (brandingName !== undefined) {
        tenantUpdates.name = String(brandingName).trim();
      }

      await masterDb.updateTenant(tenantId, tenantUpdates);
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
      ...(smsNotifications !== undefined ? { smsNotifications: Boolean(smsNotifications) } : {}),
      ...(autoReceipts !== undefined ? { autoReceipts: Boolean(autoReceipts) } : {}),
      ...paymentPatch,
    };

    const smsValidationError = validateSmsPaymentSettings(updatedSettings);
    if (smsValidationError) {
      return res.status(400).json({ error: smsValidationError });
    }

    const Tenant = await getTenantModel();
    const tenantDoc = await Tenant.findById(req.tenantId || tenant._id || tenant.id);
    if (!tenantDoc) return res.status(404).json({ error: 'Tenant not found' });

    if (brandingName !== undefined) {
      syncBrandingNameWithTenantName(tenantDoc, brandingName);
    }

    tenantDoc.config = {
      ...(tenantDoc.config || existingCfg),
      settings: updatedSettings,
    };
    await tenantDoc.save();

    res.json({ message: 'Settings updated successfully', config: tenantDoc.config });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
};
