import dotenv from 'dotenv';
import { connectMasterDB } from '../config/db.js';
import { getTenantModel } from '../models/Tenant.js';

dotenv.config();

const checkTenants = async () => {
  try {
    await connectMasterDB();
    console.log('Connected to master database\n');

    const Tenant = await getTenantModel();
    const tenants = await Tenant.find({ deletedAt: null }).sort({ createdAt: -1 });

    console.log(`Total tenants: ${tenants.length}\n`);

    if (tenants.length === 0) {
      console.log('No tenants found. You can create one from the Multi-Admin Dashboard.');
    } else {
      console.log('Existing tenants:');
      tenants.forEach((tenant, index) => {
        console.log(`\n${index + 1}. ${tenant.name}`);
        console.log(`   Slug: ${tenant.slug}`);
        console.log(`   Database: ${tenant.databaseName}`);
        console.log(`   Status: ${tenant.status}`);
        console.log(`   Created: ${new Date(tenant.createdAt).toLocaleDateString()}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking tenants:', error);
    process.exit(1);
  }
};

checkTenants();

