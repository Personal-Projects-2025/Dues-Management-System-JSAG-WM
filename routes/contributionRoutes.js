import express from 'express';
import {
  createContribution,
  getAllContributions,
  getContributionById,
  getFinancialBreakdown
} from '../controllers/contributionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';
import { validateContribution, validateMongoId, validatePagination } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/', validateContribution, createContribution);
router.get('/', validatePagination, getAllContributions);
router.get('/breakdown', getFinancialBreakdown);
router.get('/:id', validateMongoId, getContributionById);

export default router;
