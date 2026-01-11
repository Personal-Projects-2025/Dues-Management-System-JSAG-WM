import express from 'express';
import {
  getPendingTenants,
  getRejectedTenants,
  getTenantDetails,
  approveTenant,
  rejectTenant
} from '../controllers/tenantApprovalController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateMongoId, handleValidationErrors } from '../middleware/validationMiddleware.js';
import { body } from 'express-validator';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get pending tenants
router.get('/pending', getPendingTenants);

// Get rejected tenants
router.get('/rejected', getRejectedTenants);

// Get tenant details
router.get('/:id', validateMongoId, getTenantDetails);

// Approve tenant
router.post('/:id/approve', validateMongoId, approveTenant);

// Reject tenant
router.post('/:id/reject', 
  validateMongoId,
  body('rejectionReason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters'),
  handleValidationErrors,
  rejectTenant
);

export default router;

