import express from 'express';
import { getHospitals, verifyHospital, getDashboardData, updateTerpakai, updateGudang, updateRoomStock, updateSO } from '../../controllers/ikm/dashboard.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all IKM dashboard routes
router.use(authenticateToken);

// GET /api/ikm/hospitals
router.get('/hospitals', getHospitals);

// POST /api/ikm/verify-hospital
router.post('/verify-hospital', verifyHospital);

// GET /api/ikm/dashboard-data
router.get('/dashboard-data', getDashboardData);

// POST /api/ikm/update-terpakai
router.post('/update-terpakai', updateTerpakai);

// POST /api/ikm/update-gudang
router.post('/update-gudang', updateGudang);

// POST /api/ikm/update-room-stock
router.post('/update-room-stock', updateRoomStock);

// POST /api/ikm/update-so
router.post('/update-so', updateSO);

export default router;
