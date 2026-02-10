import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Master database connection (for tenant metadata and user-tenant mapping)
let masterConnection = null;

/**
 * Resolve the master database URI.
 * Priority: MASTER_DB_URI (full URI) > MONGODB_URI + MASTER_DB_NAME > MONGODB_URI only.
 */
const getMasterUri = () => {
  const fullUri = process.env.MASTER_DB_URI;
  if (fullUri) return fullUri;

  const baseUri = process.env.MONGODB_URI;
  if (!baseUri) return null;

  const masterDbName = process.env.MASTER_DB_NAME;
  if (!masterDbName) return baseUri;

  // Strip trailing slash from base and any existing path (use server only for consistency)
  const withoutQuery = baseUri.split('?')[0];
  const query = baseUri.includes('?') ? '?' + baseUri.split('?').slice(1).join('?') : '';
  const parts = withoutQuery.split('/');
  const lastPart = parts[parts.length - 1] || '';
  const hasPathDb = parts.length >= 4 && !lastPart.includes('@') && !lastPart.includes(':');
  const serverPart = hasPathDb ? parts.slice(0, -1).join('/') : withoutQuery;
  return `${serverPart}/${masterDbName}${query}`;
};

export const connectMasterDB = async () => {
  try {
    if (masterConnection && masterConnection.readyState === 1) {
      return masterConnection;
    }

    const masterUri = getMasterUri();
    if (!masterUri) {
      throw new Error('MONGODB_URI or MASTER_DB_URI must be set in environment variables');
    }

    masterConnection = mongoose.createConnection(masterUri);
    
    // Wait for the connection to be established
    await masterConnection.asPromise();
    
    const dbName = masterConnection.db?.databaseName || 'unknown';
    console.log(`Master MongoDB Connected: ${dbName}`);
    return masterConnection;
  } catch (error) {
    console.error(`Master DB Error: ${error.message}`);
    throw error;
  }
};

// Legacy connection for backward compatibility (connects to master DB)
const connectDB = async () => {
  try {
    const conn = await connectMasterDB();
    const dbName = conn.db?.databaseName || 'unknown';
    console.log(`MongoDB Connected: ${dbName}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
export { masterConnection };

