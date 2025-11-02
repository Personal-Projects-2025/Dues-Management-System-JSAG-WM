import express from 'express';
import {
  createReceipt,
  getMemberReceipts,
  getReceiptPDF,
  getReceiptById,
  getAllReceipts
} from '../controllers/receiptController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

// All routes require authentication and admin role
router.post('/generate', authenticateToken, requireAdmin, createReceipt);
router.get('/', authenticateToken, requireAdmin, getAllReceipts);
router.get('/member/:memberId', authenticateToken, requireAdmin, getMemberReceipts);
router.get('/:receiptId', authenticateToken, requireAdmin, getReceiptById);
router.get('/pdf/:receiptId', authenticateToken, requireAdmin, getReceiptPDF);

export default router;

