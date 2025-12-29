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
import { setTenantContext, requireTenant } from '../middleware/tenantMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(setTenantContext);
router.use(requireTenant);

router.post('/', requireSuper, createSubgroup);
router.get('/', requireAdmin, getSubgroups);
router.get('/leaderboard', requireAdmin, getSubgroupLeaderboard);
router.get('/:id', requireAdmin, getSubgroupById);
router.put('/:id', requireSuper, updateSubgroup);
router.delete('/:id', requireSuper, deleteSubgroup);

export default router;


