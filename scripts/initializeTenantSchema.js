import mongoose from 'mongoose';
import { getTenantConnection } from '../utils/connectionManager.js';
import { getTenantModel as getModelFromFactory } from '../utils/modelFactory.js';
import {
  memberSchema,
  subgroupSchema,
  expenditureSchema,
  receiptSchema,
  reminderSchema,
  activityLogSchema
} from '../models/schemas.js';

/**
 * Initialize all models in a tenant database
 * @param {string} databaseName - Name of the tenant database
 */
export const initializeTenantSchema = async (databaseName) => {
  try {
    // Get tenant connection
    const tenantConnection = await getTenantConnection(databaseName);

    // Initialize all models on the tenant connection
    // Models will be created if they don't exist
    getModelFromFactory(tenantConnection, 'Member', memberSchema);
    getModelFromFactory(tenantConnection, 'Subgroup', subgroupSchema);
    getModelFromFactory(tenantConnection, 'Expenditure', expenditureSchema);
    getModelFromFactory(tenantConnection, 'Receipt', receiptSchema);
    getModelFromFactory(tenantConnection, 'Reminder', reminderSchema);
    getModelFromFactory(tenantConnection, 'ActivityLog', activityLogSchema);

    // Create indexes
    const Member = tenantConnection.models.Member;
    const Subgroup = tenantConnection.models.Subgroup;
    const Expenditure = tenantConnection.models.Expenditure;
    const Receipt = tenantConnection.models.Receipt;
    const Reminder = tenantConnection.models.Reminder;
    const ActivityLog = tenantConnection.models.ActivityLog;

    // Create indexes for better performance
    await Member.createIndexes();
    await Subgroup.createIndexes();
    await Expenditure.createIndexes();
    await Receipt.createIndexes();
    await Reminder.createIndexes();
    await ActivityLog.createIndexes();

    console.log(`Tenant schema initialized for database: ${databaseName}`);
    return true;
  } catch (error) {
    console.error(`Error initializing tenant schema for ${databaseName}:`, error);
    throw error;
  }
};

