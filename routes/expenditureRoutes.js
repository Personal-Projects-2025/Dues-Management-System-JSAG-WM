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

const router = express.Router();

// All routes require authentication and admin role
router.post('/', authenticateToken, requireAdmin, createExpenditure);
router.get('/', authenticateToken, requireAdmin, getAllExpenditures);
router.get('/stats', authenticateToken, requireAdmin, getExpenditureStats);
router.get('/:id', authenticateToken, requireAdmin, getExpenditureById);
router.put('/:id', authenticateToken, requireAdmin, updateExpenditure);
router.delete('/:id', authenticateToken, requireAdmin, deleteExpenditure);

export default router;

