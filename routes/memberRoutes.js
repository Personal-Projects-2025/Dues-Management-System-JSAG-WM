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

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, getAllMembers);
router.get('/arrears', authenticateToken, requireAdmin, getMembersInArrears);
router.get('/:id', authenticateToken, requireAdmin, getMemberById);
router.post('/', authenticateToken, requireAdmin, createMember);
router.put('/:id', authenticateToken, requireAdmin, updateMember);
router.delete('/:id', authenticateToken, requireAdmin, deleteMember);

export default router;

