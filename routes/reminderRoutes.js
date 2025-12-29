import express from 'express';
import {
  triggerReminders,
  getReminderLogs,
  getReminderSummary
} from '../controllers/reminderController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/send', triggerReminders);
router.get('/', getReminderLogs);
router.get('/summary', getReminderSummary);

export default router;


