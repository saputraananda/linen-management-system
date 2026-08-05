import express from 'express';
import { getDashboardData, updateTerpakai, getLinenLogs } from '../../controllers/unit/unit-dashboard.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all unit dashboard routes
router.use(authenticateToken);

// GET /api/unit/dashboard-data
router.get('/dashboard-data', getDashboardData);

// POST /api/unit/update-terpakai
router.post('/update-terpakai', updateTerpakai);

// GET /api/unit/linen-logs
router.get('/linen-logs', getLinenLogs);

export default router;
