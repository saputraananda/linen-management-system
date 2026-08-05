import express from 'express';
import { getDashboardData, updateTerpakai, updateGudang, updateRoomStock } from '../../controllers/rs/rs-dashboard.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all RS dashboard routes
router.use(authenticateToken);

// GET /api/rs/dashboard-data
router.get('/dashboard-data', getDashboardData);

// POST /api/rs/update-terpakai
router.post('/update-terpakai', updateTerpakai);

// POST /api/rs/update-gudang
router.post('/update-gudang', updateGudang);

// POST /api/rs/update-room-stock
router.post('/update-room-stock', updateRoomStock);

export default router;