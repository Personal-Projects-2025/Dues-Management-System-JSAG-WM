import express from 'express';
import {
  recordPayment,
  getAllPayments,
  getPaymentById
} from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.post('/', recordPayment);
router.get('/', getAllPayments);
router.get('/:memberId/:paymentId', getPaymentById);

export default router;

