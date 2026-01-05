import express from 'express';
import {
  createExpenditure,
  getAllExpenditures,
  getExpenditureById,
  updateExpenditure,
  deleteExpenditure,
  getExpenditureStats
} from '../controllers/expenditureController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';
import { validateExpenditure, validateMongoId, validatePagination } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/', validateExpenditure, createExpenditure);
router.get('/', validatePagination, getAllExpenditures);
router.get('/stats', getExpenditureStats);
router.get('/:id', validateMongoId, getExpenditureById);
router.put('/:id', validateMongoId, validateExpenditure, updateExpenditure);
router.delete('/:id', validateMongoId, deleteExpenditure);

export default router;

