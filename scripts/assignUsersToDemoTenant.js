import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectMasterDB } from '../config/db.js';
import { getTenantModel } from '../models/Tenant.js';
import { getUserModel } from '../models/User.js';
import { initializeTenantSchema } from './initializeTenantSchema.js';

dotenv.config();

/**
 * Assign all existing users to Demo Tenant
 * This script should be run to migrate existing users to the multi-tenant system
 */
export const assignUsersToDemoTenant = async () => {
  try {
    console.log('Starting user assignment to Demo Tenant...');

    // Connect to master database
    await connectMasterDB();

    const Tenant = await getTenantModel();
    const User = await getUserModel();

    // Find or create demo tenant
    const demoTenantName = process.env.DEFAULT_TENANT_NAME || 'demo';
    const demoTenantDb = process.env.DEFAULT_TENANT_DB || 'demo-tenant';

    let demoTenant = await Tenant.findOne({
      slug: demoTenantName,
      deletedAt: null
    });

    if (!demoTenant) {
      console.log('Creating Demo Tenant...');
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
      console.log('Demo Tenant created');

      // Initialize tenant database schema
      await initializeTenantSchema(demoTenantDb);
      console.log('Demo Tenant database initialized');
    } else {
      console.log('Demo Tenant already exists');
    }

    // Get all users without tenantId (excluding system users)
    const usersWithoutTenant = await User.find({
      tenantId: null,
      role: { $ne: 'system' }
    });

    console.log(`Found ${usersWithoutTenant.length} users without tenant assignment`);

    // Assign all users to demo tenant
    let assignedCount = 0;
    for (const user of usersWithoutTenant) {
      user.tenantId = demoTenant._id;
      await user.save();
      assignedCount++;
      console.log(`Assigned user ${user.username} to Demo Tenant`);
    }

    console.log(`\nMigration completed:`);
    console.log(`- Demo Tenant: ${demoTenant.name} (${demoTenant.slug})`);
    console.log(`- Users assigned: ${assignedCount}`);
    console.log(`- Database: ${demoTenant.databaseName}`);

    return {
      success: true,
      demoTenant: {
        id: demoTenant._id,
        name: demoTenant.name,
        slug: demoTenant.slug,
        databaseName: demoTenant.databaseName
      },
      usersAssigned: assignedCount
    };
  } catch (error) {
    console.error('Error assigning users to Demo Tenant:', error);
    throw error;
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  assignUsersToDemoTenant()
    .then(result => {
      console.log('Assignment result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Assignment failed:', error);
      process.exit(1);
    });
}


