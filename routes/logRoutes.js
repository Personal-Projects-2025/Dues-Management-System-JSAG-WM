import express from 'express';
import {
  getActivityLogs,
  exportActivityLogs,
  deleteActivityLog
} from '../controllers/logController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, getActivityLogs);
router.get('/export', authenticateToken, requireAdmin, exportActivityLogs);
router.delete('/:id', authenticateToken, requireAdmin, deleteActivityLog);

export default router;

