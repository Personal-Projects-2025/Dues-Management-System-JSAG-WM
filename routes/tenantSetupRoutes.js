import express from 'express';
import jwt from 'jsonwebtoken';
import {
  registerTenant,
  getSetupStatus
} from '../controllers/tenantSetupController.js';
import {
  createRegistrationSession,
  sendRegistrationEmailOtp,
  verifyRegistrationEmailOtp,
  sendRegistrationPhoneOtp,
  verifyRegistrationPhoneOtp
} from '../controllers/tenantRegistrationOtpController.js';

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

router.post('/register/session', optionalAuth, createRegistrationSession);
router.post('/register/verify-email/send', optionalAuth, sendRegistrationEmailOtp);
router.post('/register/verify-email', optionalAuth, verifyRegistrationEmailOtp);
router.post('/register/verify-phone/send', optionalAuth, sendRegistrationPhoneOtp);
router.post('/register/verify-phone', optionalAuth, verifyRegistrationPhoneOtp);

// Public registration (self-service) or authenticated (system admin bypasses OTP)
router.post('/register', optionalAuth, registerTenant);

// Public endpoint to check setup status
router.get('/status/:slug', getSetupStatus);

export default router;

