import { requireRole } from './authMiddleware.js';

export const requireSystem = requireRole('system');
export const requireSuper = requireRole('super', 'system');
export const requireAdmin = requireRole('admin', 'super', 'system');
export const requireAnyAuth = requireRole('admin', 'super', 'system');

