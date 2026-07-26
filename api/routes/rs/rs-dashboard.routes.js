import express from 'express';
import { getDashboardData } from '../../controllers/rs/rs-dashboard.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all RS dashboard routes
router.use(authenticateToken);

// GET /api/rs/dashboard-data
router.get('/dashboard-data', getDashboardData);

export default router;
