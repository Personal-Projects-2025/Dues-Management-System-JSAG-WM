import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireSystemUser } from '../middleware/tenantMiddleware.js';
import {
  getSystemUsers,
  getSuperUsers,
  createSystemUser
} from '../controllers/systemController.js';

const router = express.Router();

// All routes require authentication and system user role
router.use(authenticateToken);
router.use(requireSystemUser);

router.get('/users', getSystemUsers);
router.get('/super-users', getSuperUsers);
router.post('/create-user', createSystemUser);

export default router;

