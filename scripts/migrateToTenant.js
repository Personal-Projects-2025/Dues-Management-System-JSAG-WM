import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectMasterDB } from '../config/db.js';
import { getTenantModel } from '../models/Tenant.js';
import { getUserModel } from '../models/User.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { initializeTenantSchema } from './initializeTenantSchema.js';

dotenv.config();

/**
 * Migrate existing demo data to a demo tenant
 * This script should be run on first startup to migrate existing data
 */
export const migrateToDemoTenant = async () => {
  try {
    console.log('Starting migration to demo tenant...');

    // Connect to master database
    await connectMasterDB();

    // Check if demo tenant already exists
    const Tenant = await getTenantModel();
    const demoTenantName = process.env.DEFAULT_TENANT_NAME || 'demo';
    const demoTenantDb = process.env.DEFAULT_TENANT_DB || 'demo-tenant';

    let demoTenant = await Tenant.findOne({
      $or: [
        { slug: demoTenantName },
        { databaseName: demoTenantDb }
      ]
    });

    if (demoTenant) {
      console.log('Demo tenant already exists, skipping migration');
      return { migrated: false, tenant: demoTenant };
    }

    // Get original database connection
    const originalDbUri = process.env.MONGODB_URI;
    if (!originalDbUri) {
      throw new Error('MONGODB_URI not set');
    }

    const originalConn = await mongoose.createConnection(originalDbUri);

    // Check if original database has data
    const collections = await originalConn.db.listCollections().toArray();
    const hasData = collections.some(col => {
      const collectionName = col.name;
      return !collectionName.startsWith('system.') && 
             collectionName !== 'users' && 
             collectionName !== 'tenants';
    });

    if (!hasData) {
      console.log('No data found in original database, creating empty demo tenant');
      // Create empty demo tenant
      demoTenant = new Tenant({
        name: 'Demo Organization',
        slug: demoTenantName,
        databaseName: demoTenantDb,
        status: 'active',
        config: {
          branding: {
            name: 'Demo Organization',
            primaryColor: '#3B82F6',
            secondaryColor: '#1E40AF'
          }
        }
      });
      await demoTenant.save();
      await initializeTenantSchema(demoTenantDb);
      await originalConn.close();
      return { migrated: false, tenant: demoTenant, reason: 'No data to migrate' };
    }

    // Create demo tenant
    demoTenant = new Tenant({
      name: 'Demo Organization',
      slug: demoTenantName,
      databaseName: demoTenantDb,
      status: 'active',
      config: {
        branding: {
          name: 'Demo Organization',
          primaryColor: '#3B82F6',
          secondaryColor: '#1E40AF'
        }
      }
    });
    await demoTenant.save();

    // Initialize tenant database schema
    await initializeTenantSchema(demoTenantDb);

    // Get tenant connection
    const tenantConn = await getTenantConnection(demoTenantDb);

    // Migrate data from original database to tenant database
    const collectionsToMigrate = ['members', 'subgroups', 'expenditures', 'receipts', 'reminders', 'activitylogs'];

    for (const collectionName of collectionsToMigrate) {
      try {
        const originalCollection = originalConn.db.collection(collectionName);
        const tenantCollection = tenantConn.db.collection(collectionName);

        const count = await originalCollection.countDocuments();
        if (count > 0) {
          const documents = await originalCollection.find({}).toArray();
          if (documents.length > 0) {
            await tenantCollection.insertMany(documents);
            console.log(`Migrated ${documents.length} documents from ${collectionName}`);
          }
        }
      } catch (error) {
        // Collection might not exist, skip it
        console.log(`Skipping ${collectionName}: ${error.message}`);
      }
    }

    // Migrate users and associate with demo tenant
    try {
      const User = await getUserModel();
      const originalUsersCollection = originalConn.db.collection('users');
      const users = await originalUsersCollection.find({}).toArray();

      for (const user of users) {
        // Check if user already exists
        const existingUser = await User.findOne({ username: user.username });
        if (!existingUser) {
          const newUser = new User({
            username: user.username,
            passwordHash: user.passwordHash,
            role: user.role,
            tenantId: demoTenant._id,
            createdAt: user.createdAt || new Date(),
            lastLogin: user.lastLogin
          });
          await newUser.save();
          console.log(`Migrated user: ${user.username}`);
        } else {
          // Update existing user to associate with demo tenant
          existingUser.tenantId = demoTenant._id;
          await existingUser.save();
          console.log(`Updated user: ${user.username} to demo tenant`);
        }
      }
    } catch (error) {
      console.error('Error migrating users:', error);
    }

    await originalConn.close();

    console.log('Migration completed successfully');
    return { migrated: true, tenant: demoTenant };
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToDemoTenant()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

