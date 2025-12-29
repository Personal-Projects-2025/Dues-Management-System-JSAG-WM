import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connection pool cache
const tenantConnections = new Map();
const connectionConfig = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000
};

/**
 * Get or create a connection to a tenant database
 * @param {string} databaseName - The name of the tenant database
 * @returns {Promise<mongoose.Connection>} - The connection instance
 */
export const getTenantConnection = async (databaseName) => {
  if (!databaseName) {
    throw new Error('Database name is required');
  }

  // Check if connection already exists and is ready
  if (tenantConnections.has(databaseName)) {
    const conn = tenantConnections.get(databaseName);
    if (conn.readyState === 1) {
      return conn;
    }
    // Remove stale connection
    tenantConnections.delete(databaseName);
  }

  try {
    // Get base MongoDB URI (without database name)
    const baseUri = process.env.MONGODB_URI || process.env.MASTER_DB_URI;
    if (!baseUri) {
      throw new Error('MONGODB_URI or MASTER_DB_URI must be set');
    }

    // Extract connection string without database name
    const uriParts = baseUri.split('/');
    const baseConnectionString = uriParts.slice(0, -1).join('/');
    const tenantUri = `${baseConnectionString}/${databaseName}`;

    // Create new connection
    const conn = mongoose.createConnection(tenantUri, {
      ...connectionConfig,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });

    // Wait for connection to be ready
    await conn.asPromise();

    // Cache the connection
    tenantConnections.set(databaseName, conn);

    console.log(`Connected to tenant database: ${databaseName}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to tenant database ${databaseName}:`, error.message);
    throw error;
  }
};

/**
 * Close a specific tenant connection
 * @param {string} databaseName - The name of the tenant database
 */
export const closeTenantConnection = async (databaseName) => {
  if (tenantConnections.has(databaseName)) {
    const conn = tenantConnections.get(databaseName);
    await conn.close();
    tenantConnections.delete(databaseName);
    console.log(`Closed connection to tenant database: ${databaseName}`);
  }
};

/**
 * Close all tenant connections
 */
export const closeAllTenantConnections = async () => {
  const closePromises = Array.from(tenantConnections.entries()).map(
    async ([dbName, conn]) => {
      try {
        await conn.close();
        console.log(`Closed connection to tenant database: ${dbName}`);
      } catch (error) {
        console.error(`Error closing connection to ${dbName}:`, error.message);
      }
    }
  );

  await Promise.all(closePromises);
  tenantConnections.clear();
};

/**
 * Get all active tenant connections
 * @returns {Array<string>} - Array of database names with active connections
 */
export const getActiveConnections = () => {
  return Array.from(tenantConnections.keys());
};

/**
 * Clean up idle connections (connections that haven't been used recently)
 * This can be called periodically to free up resources
 */
export const cleanupIdleConnections = async () => {
  const now = Date.now();
  const connectionsToClose = [];

  for (const [dbName, conn] of tenantConnections.entries()) {
    // Check if connection is idle (simplified check)
    // In production, you might want more sophisticated idle detection
    if (conn.readyState !== 1) {
      connectionsToClose.push(dbName);
    }
  }

  for (const dbName of connectionsToClose) {
    await closeTenantConnection(dbName);
  }
};

// Cleanup on process exit
process.on('SIGINT', async () => {
  await closeAllTenantConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeAllTenantConnections();
  process.exit(0);
});

