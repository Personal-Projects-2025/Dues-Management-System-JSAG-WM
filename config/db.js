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
    masterConnection = await mongoose.createConnection(masterUri);
    console.log(`Master MongoDB Connected: ${masterConnection.host}`);
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
    console.log(`MongoDB Connected: ${conn.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
export { masterConnection };

