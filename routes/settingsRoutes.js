import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireSuper } from '../middleware/roleMiddleware.js';
import { setTenantMasterOnly } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantMasterOnly);

router.get('/', getSettings);
router.patch('/', requireSuper, updateSettings);

export default router;
