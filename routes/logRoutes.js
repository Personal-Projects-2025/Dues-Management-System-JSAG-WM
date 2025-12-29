import express from 'express';
import {
  getActivityLogs,
  exportActivityLogs,
  deleteActivityLog
} from '../controllers/logController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.get('/', getActivityLogs);
router.get('/export', exportActivityLogs);
router.delete('/:id', deleteActivityLog);

export default router;

