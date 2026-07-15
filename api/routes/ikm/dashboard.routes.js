import express from 'express';
import { getHospitals, verifyHospital, getDashboardData } from '../../controllers/ikm/dashboard.controller.js';
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

export default router;
