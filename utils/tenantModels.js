/**
 * Tenant Models Utility
 * Provides tenant-scoped model instances using the connection from request context
 */

import {
  memberSchema,
  subgroupSchema,
  expenditureSchema,
  receiptSchema,
  reminderSchema,
  activityLogSchema
} from '../models/schemas.js';
import { getTenantModel } from './modelFactory.js';

/**
 * Get all tenant-scoped models from request context
 * @param {Object} req - Express request object with tenantConnection
 * @returns {Object} - Object containing all tenant models
 */
export const getTenantModels = (req) => {
  if (!req.tenantConnection) {
    throw new Error('Tenant connection not found in request context. Ensure tenantMiddleware is applied.');
  }

  return {
    Member: getTenantModel(req.tenantConnection, 'Member', memberSchema),
    Subgroup: getTenantModel(req.tenantConnection, 'Subgroup', subgroupSchema),
    Expenditure: getTenantModel(req.tenantConnection, 'Expenditure', expenditureSchema),
    Receipt: getTenantModel(req.tenantConnection, 'Receipt', receiptSchema),
    Reminder: getTenantModel(req.tenantConnection, 'Reminder', reminderSchema),
    ActivityLog: getTenantModel(req.tenantConnection, 'ActivityLog', activityLogSchema)
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

