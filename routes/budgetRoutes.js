import express from 'express';
import {
  createBudget,
  getAllBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
  getBudgetSummary
} from '../controllers/budgetController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';
import { validateCreateBudget, validateBudget, validateMongoId } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/', validateCreateBudget, createBudget);
router.get('/', getAllBudgets);
router.get('/:id/summary', validateMongoId, getBudgetSummary);
router.get('/:id', validateMongoId, getBudgetById);
router.put('/:id', validateMongoId, validateBudget, updateBudget);
router.delete('/:id', validateMongoId, deleteBudget);

export default router;
