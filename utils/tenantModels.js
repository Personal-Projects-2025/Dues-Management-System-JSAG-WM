/**
 * Tenant Models Utility
 * Provides tenant-scoped model instances (Supabase or Mongoose) from request context
 */

import { useSupabase } from '../config/supabase.js';
import {
  memberSchema,
  subgroupSchema,
  expenditureSchema,
  receiptSchema,
  reminderSchema,
  activityLogSchema,
  contributionTypeSchema,
  contributionSchema
} from '../models/schemas.js';
import { getTenantModel } from './modelFactory.js';
import { getTenantModels as getSupabaseTenantModels } from '../db/tenantDb.js';

/**
 * Get all tenant-scoped models from request context
 * Uses Supabase when USE_SUPABASE=true, otherwise Mongoose tenant connection.
 * @param {Object} req - Express request object (tenantConnection for Mongo, tenantId for Supabase)
 * @returns {Object} - Tenant-scoped models
 */
export const getTenantModels = (req) => {
  if (useSupabase()) {
    if (!req.tenantId) {
      throw new Error('Tenant context (tenantId) not found. Ensure tenantMiddleware is applied.');
    }
    return getSupabaseTenantModels(req);
  }

  if (!req.tenantConnection) {
    throw new Error('Tenant connection not found in request context. Ensure tenantMiddleware is applied.');
  }

  return {
    Member: getTenantModel(req.tenantConnection, 'Member', memberSchema),
    Subgroup: getTenantModel(req.tenantConnection, 'Subgroup', subgroupSchema),
    Expenditure: getTenantModel(req.tenantConnection, 'Expenditure', expenditureSchema),
    Receipt: getTenantModel(req.tenantConnection, 'Receipt', receiptSchema),
    Reminder: getTenantModel(req.tenantConnection, 'Reminder', reminderSchema),
    ActivityLog: getTenantModel(req.tenantConnection, 'ActivityLog', activityLogSchema),
    ContributionType: getTenantModel(req.tenantConnection, 'ContributionType', contributionTypeSchema),
    Contribution: getTenantModel(req.tenantConnection, 'Contribution', contributionSchema)
  };
};

/**
 * Get a specific tenant model by name
 * @param {Object} req - Express request object with tenantConnection
 * @param {string} modelName - Name of the model to get
 * @returns {mongoose.Model} - The model instance
 */
export const getTenantModelByName = (req, modelName) => {
  const models = getTenantModels(req);
  if (!models[modelName]) {
    throw new Error(`Model ${modelName} not found`);
  }
  return models[modelName];
};

