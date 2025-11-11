import express from 'express';
import {
  triggerReminders,
  getReminderLogs,
  getReminderSummary
} from '../controllers/reminderController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/send', authenticateToken, requireAdmin, triggerReminders);
router.get('/', authenticateToken, requireAdmin, getReminderLogs);
router.get('/summary', authenticateToken, requireAdmin, getReminderSummary);

export default router;


