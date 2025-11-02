import { requireRole } from './authMiddleware.js';

export const requireSuper = requireRole('super');
export const requireAdmin = requireRole('admin', 'super');
export const requireAnyAuth = requireRole('admin', 'super');

