import express from 'express';
import {
  createSubgroup,
  getSubgroups,
  getSubgroupById,
  updateSubgroup,
  deleteSubgroup,
  getSubgroupLeaderboard
} from '../controllers/subgroupController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin, requireSuper } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, requireSuper, createSubgroup);
router.get('/', authenticateToken, requireAdmin, getSubgroups);
router.get('/leaderboard', authenticateToken, requireAdmin, getSubgroupLeaderboard);
router.get('/:id', authenticateToken, requireAdmin, getSubgroupById);
router.put('/:id', authenticateToken, requireSuper, updateSubgroup);
router.delete('/:id', authenticateToken, requireSuper, deleteSubgroup);

export default router;


