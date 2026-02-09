import express from 'express';
import {
  getAllContributionTypes,
  createContributionType,
  getContributionTypeById,
  updateContributionType,
  deleteContributionType
} from '../controllers/contributionTypeController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';
import { validateContributionType, validateContributionTypeUpdate, validateMongoId } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.get('/', getAllContributionTypes);
router.post('/', validateContributionType, createContributionType);
router.get('/:id', validateMongoId, getContributionTypeById);
router.put('/:id', validateMongoId, validateContributionTypeUpdate, updateContributionType);
router.delete('/:id', validateMongoId, deleteContributionType);

export default router;
