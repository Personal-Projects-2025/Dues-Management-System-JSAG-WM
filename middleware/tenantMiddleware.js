import { getTenantConnection } from '../utils/connectionManager.js';
import { getTenantModel } from '../models/Tenant.js';

/**
 * Middleware to extract tenant ID from JWT and set tenant context
 * Also validates tenant exists and is active
 */
export const setTenantContext = async (req, res, next) => {
  try {
    // Extract tenant ID from JWT (set by auth middleware)
    let tenantId = req.user?.tenantId;

    // System Users exist above all tenants - they don't need tenant context
    if (req.user?.role === 'system') {
      req.tenant = null;
      req.tenantConnection = null;
      req.isSystemUser = true;
      return next();
    }

    // Get Tenant model
    const Tenant = await getTenantModel();

    // If user doesn't have tenantId, try to find or create demo tenant and assign user
    if (!tenantId && req.user?.userId) {
      try {
        const { getUserModel } = await import('../models/User.js');
        const User = await getUserModel();
        const user = await User.findById(req.user.userId);
        
        if (!user) {
          console.error('User not found in database:', req.user.userId);
          return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has tenantId in database
        tenantId = user.tenantId ? user.tenantId.toString() : null;
        
        // If user still doesn't have tenantId, assign to demo tenant
        if (!tenantId) {
          console.log(`Assigning user ${user.username} (${user.role}) to demo tenant...`);
          
          // Try to find demo tenant
          const demoTenantName = process.env.DEFAULT_TENANT_NAME || 'demo';
          let demoTenant = await Tenant.findOne({ 
            slug: demoTenantName,
            deletedAt: null 
          });

          // If demo tenant doesn't exist, create it
          if (!demoTenant) {
            console.log('Creating demo tenant...');
            const demoTenantDb = process.env.DEFAULT_TENANT_DB || 'demo-tenant';
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
            console.log('Demo tenant created:', demoTenant._id.toString());

            // Initialize tenant database
            try {
              const { initializeTenantSchema } = await import('../scripts/initializeTenantSchema.js');
              await initializeTenantSchema(demoTenantDb);
              console.log('Demo tenant database initialized');
            } catch (schemaError) {
              console.error('Error initializing tenant schema:', schemaError);
              // Continue anyway - schema might already exist
            }
          }

          // Assign user to demo tenant
          user.tenantId = demoTenant._id;
          await user.save();
          tenantId = demoTenant._id.toString();
          console.log(`User ${user.username} assigned to demo tenant: ${tenantId}`);
        } else {
          tenantId = tenantId.toString();
        }
      } catch (assignError) {
        console.error('Error assigning user to tenant:', assignError);
        console.error('Stack:', assignError.stack);
        // Don't return error here - let it try to continue with tenantId if available
      }
    }

    // Convert tenantId to string if it's an ObjectId
    if (tenantId && typeof tenantId !== 'string') {
      tenantId = tenantId.toString();
    }

    if (!tenantId) {
      console.error('No tenantId found for user:', {
        userId: req.user?.userId,
        username: req.user?.username,
        role: req.user?.role,
        jwtTenantId: req.user?.tenantId
      });
      return res.status(400).json({ 
        error: 'Tenant ID is required. Please log out and log back in to refresh your session.',
        userId: req.user?.userId,
        role: req.user?.role
      });
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Handle different tenant statuses
    if (tenant.status === 'rejected') {
      return res.status(403).json({ 
        error: 'Your organization registration has been rejected',
        status: tenant.status,
        rejectionReason: tenant.rejectionReason || 'No reason provided'
      });
    }
    
    if (tenant.status === 'pending') {
      // Mark as pending but still allow connection for status viewing
      req.isPendingTenant = true;
      // Continue to set up connection - routes can check status if needed
    }
    
    if (tenant.status !== 'active' && tenant.status !== 'pending') {
      return res.status(403).json({ 
        error: 'Tenant is not active',
        status: tenant.status 
      });
    }

    // Check if tenant is soft-deleted
    if (tenant.deletedAt) {
      return res.status(403).json({ error: 'Tenant has been deleted' });
    }

    // Get tenant database connection
    try {
      const tenantConnection = await getTenantConnection(tenant.databaseName);
      
      // Verify connection is ready (1 = connected)
      if (tenantConnection.readyState !== 1) {
        console.warn(`Tenant database connection state: ${tenantConnection.readyState} for ${tenant.databaseName}`);
        // Still proceed - connection might be in progress
      }

      // Ensure tenant database schema is initialized
      try {
        const collections = await tenantConnection.db.listCollections().toArray();
        if (collections.length === 0) {
          console.log(`Initializing schema for tenant database: ${tenant.databaseName}`);
          const { initializeTenantSchema } = await import('../scripts/initializeTenantSchema.js');
          await initializeTenantSchema(tenant.databaseName);
        }
      } catch (schemaError) {
        console.warn('Schema check/initialization warning:', schemaError.message);
        // Continue - schema might already exist or will be created on first use
      }

      // Set tenant context on request object
      req.tenant = tenant;
      req.tenantId = tenantId;
      req.tenantConnection = tenantConnection;
      req.databaseName = tenant.databaseName;

      next();
    } catch (connError) {
      console.error(`Error connecting to tenant database ${tenant.databaseName}:`, connError);
      console.error('Connection error details:', {
        message: connError.message,
        name: connError.name,
        code: connError.code
      });
      
      // Try to initialize schema and retry
      try {
        console.log(`Attempting to initialize tenant database: ${tenant.databaseName}`);
        const { initializeTenantSchema } = await import('../scripts/initializeTenantSchema.js');
        await initializeTenantSchema(tenant.databaseName);
        
        // Retry connection
        const tenantConnection = await getTenantConnection(tenant.databaseName);
        req.tenant = tenant;
        req.tenantId = tenantId;
        req.tenantConnection = tenantConnection;
        req.databaseName = tenant.databaseName;
        next();
      } catch (initError) {
        console.error('Error initializing tenant database:', initError);
        return res.status(500).json({ 
          error: 'Failed to connect to tenant database',
          tenant: tenant.name,
          details: process.env.NODE_ENV === 'development' ? initError.message : undefined
        });
      }
    }
  } catch (error) {
    console.error('Tenant middleware error:', error);
    console.error('Error details:', {
      userId: req.user?.userId,
      username: req.user?.username,
      role: req.user?.role,
      tenantId: req.user?.tenantId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to set tenant context',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to require tenant context (for routes that need tenant data)
 */
export const requireTenant = (req, res, next) => {
  if (!req.tenant || !req.tenantConnection) {
    return res.status(400).json({ error: 'Tenant context is required' });
  }
  next();
};

/**
 * Middleware for System User routes (no tenant context required)
 */
export const requireSystemUser = (req, res, next) => {
  if (req.user?.role !== 'system') {
    return res.status(403).json({ error: 'System User access required' });
  }
  next();
};

/**
 * Middleware for super admin routes (can work without tenant context)
 */
export const allowSuperAdmin = (req, res, next) => {
  if (req.user?.role === 'system' || req.user?.role === 'super') {
    return next();
  }
  // For non-super users, require tenant context
  if (!req.tenant || !req.tenantConnection) {
    return res.status(400).json({ error: 'Tenant context is required' });
  }
  next();
};

