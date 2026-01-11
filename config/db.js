import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Master database connection (for tenant metadata and user-tenant mapping)
let masterConnection = null;

export const connectMasterDB = async () => {
  try {
    if (masterConnection && masterConnection.readyState === 1) {
      return masterConnection;
    }

    const masterUri = process.env.MASTER_DB_URI || process.env.MONGODB_URI;
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

