import express from 'express';
import { login, register, getCurrentUser, refreshToken } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateLogin, validateRegister } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.post('/login', validateLogin, login);
router.post('/register', authenticateToken, validateRegister, register);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/refresh', authenticateToken, refreshToken);

export default router;

