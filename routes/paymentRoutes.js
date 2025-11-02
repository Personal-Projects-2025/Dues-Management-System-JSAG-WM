import express from 'express';
import {
  recordPayment,
  getAllPayments,
  getPaymentById
} from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, requireAdmin, recordPayment);
router.get('/', authenticateToken, requireAdmin, getAllPayments);
router.get('/:memberId/:paymentId', authenticateToken, requireAdmin, getPaymentById);

export default router;

