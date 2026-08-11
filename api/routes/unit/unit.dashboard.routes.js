import express from 'express';
import { getDashboardData, updateTerpakai, getLinenLogs, transferLinen, getTransferHistory, cancelTransfer } from '../../controllers/unit/unit-dashboard.controller.js';
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

// POST /api/unit/transfer-linen
router.post('/transfer-linen', transferLinen);

// GET /api/unit/transfer-history
router.get('/transfer-history', getTransferHistory);

// POST /api/unit/cancel-transfer
router.post('/cancel-transfer', cancelTransfer);

export default router;
