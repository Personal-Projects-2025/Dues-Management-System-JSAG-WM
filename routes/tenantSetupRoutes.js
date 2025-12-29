import express from 'express';
import jwt from 'jsonwebtoken';
import {
  registerTenant,
  getSetupStatus
} from '../controllers/tenantSetupController.js';

// Optional auth middleware (allows both authenticated and unauthenticated requests)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      req.user = user;
    } catch (error) {
      // Invalid token, continue without user
    }
  }
  next();
};

const router = express.Router();

// Public registration (self-service) or authenticated (super admin)
// If authenticated as super admin, can create tenants
// If not authenticated, allows self-service registration
router.post('/register', optionalAuth, registerTenant);

// Public endpoint to check setup status
router.get('/status/:slug', getSetupStatus);

export default router;

