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

const router = express.Router();

// All member routes require tenant context
router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);
router.use(requireAdmin);

router.get('/', getAllMembers);
router.get('/arrears', getMembersInArrears);
router.get('/:id', getMemberById);
router.post('/', createMember);
router.put('/:id', updateMember);
router.delete('/:id', deleteMember);

export default router;

