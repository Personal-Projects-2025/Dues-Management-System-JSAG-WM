import express from 'express';
import { login, register, getCurrentUser, refreshToken, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateLogin, validateRegister, validateForgotPassword, validateResetPassword } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.post('/login', validateLogin, login);
router.post('/register', authenticateToken, validateRegister, register);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/refresh', authenticateToken, refreshToken);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);

export default router;

