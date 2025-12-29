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

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/', createExpenditure);
router.get('/', getAllExpenditures);
router.get('/stats', getExpenditureStats);
router.get('/:id', getExpenditureById);
router.put('/:id', updateExpenditure);
router.delete('/:id', deleteExpenditure);

export default router;

