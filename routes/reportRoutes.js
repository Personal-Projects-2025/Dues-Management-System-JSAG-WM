import express from 'express';
import {
  getDashboardStats,
  exportMembersReport,
  exportPaymentsReport
} from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, requireAdmin, getDashboardStats);
router.get('/members', authenticateToken, requireAdmin, exportMembersReport);
router.get('/payments', authenticateToken, requireAdmin, exportPaymentsReport);

export default router;

