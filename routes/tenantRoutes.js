import express from 'express';
import {
  getAllTenants,
  getTenantById,
  updateTenantStatus,
  updateTenant,
  deleteTenant,
  restoreTenant
} from '../controllers/tenantController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireSystemUser } from '../middleware/tenantMiddleware.js';

const router = express.Router();

// All tenant management routes require System User
router.use(authenticateToken);
router.use(requireSystemUser);

router.get('/', getAllTenants);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.put('/:id/status', updateTenantStatus);
router.delete('/:id', deleteTenant);
router.post('/:id/restore', restoreTenant);

export default router;

