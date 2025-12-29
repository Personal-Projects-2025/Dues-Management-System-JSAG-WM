/**
 * Model Factory - Creates tenant-scoped models using the tenant connection
 * This ensures all models use the correct tenant database connection
 */

/**
 * Get a model for the current tenant context
 * @param {mongoose.Connection} tenantConnection - The tenant database connection
 * @param {string} modelName - Name of the model
 * @param {mongoose.Schema} schema - Mongoose schema for the model
 * @returns {mongoose.Model} - The model instance
 */
export const getTenantModel = (tenantConnection, modelName, schema) => {
  if (!tenantConnection) {
    throw new Error('Tenant connection is required');
  }

  // Check if model already exists on connection
  if (tenantConnection.models[modelName]) {
    return tenantConnection.models[modelName];
  }

  // Create and return model on tenant connection
  return tenantConnection.model(modelName, schema);
};

/**
 * Helper to get tenant models from request context
 * Usage: const Member = getModelFromRequest(req, 'Member', memberSchema);
 */
export const getModelFromRequest = (req, modelName, schema) => {
  if (!req.tenantConnection) {
    throw new Error('Tenant connection not found in request context');
  }
  return getTenantModel(req.tenantConnection, modelName, schema);
};

