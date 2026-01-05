import express from 'express';
import {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getMembersInArrears
} from '../controllers/memberController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';
import { validateMember, validateMongoId, validatePagination } from '../middleware/validationMiddleware.js';

const router = express.Router();

// All member routes require tenant context
router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.get('/', validatePagination, getAllMembers);
router.get('/arrears', getMembersInArrears);
router.get('/:id', validateMongoId, getMemberById);
router.post('/', ...validateMember, createMember);
router.put('/:id', validateMongoId, ...validateMember, updateMember);
router.delete('/:id', validateMongoId, deleteMember);

export default router;

