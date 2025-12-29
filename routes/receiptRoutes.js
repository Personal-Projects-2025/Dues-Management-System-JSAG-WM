import express from 'express';
import {
  createReceipt,
  getMemberReceipts,
  getReceiptPDF,
  getReceiptById,
  getAllReceipts,
  resendReceiptEmail
} from '../controllers/receiptController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/generate', createReceipt);
router.get('/', getAllReceipts);
router.get('/member/:memberId', getMemberReceipts);
router.get('/pdf/:receiptId', getReceiptPDF);
router.post('/:receiptId/resend', resendReceiptEmail);
router.get('/:receiptId', getReceiptById);

export default router;

