import express from 'express';
import {
  getDashboardStats,
  exportMembersReport,
  exportPaymentsReport
} from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/members', exportMembersReport);
router.get('/payments', exportPaymentsReport);

export default router;

