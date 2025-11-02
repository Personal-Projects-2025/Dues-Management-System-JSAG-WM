import express from 'express';
import { login, register, getCurrentUser } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', authenticateToken, register);
router.get('/me', authenticateToken, getCurrentUser);

export default router;

