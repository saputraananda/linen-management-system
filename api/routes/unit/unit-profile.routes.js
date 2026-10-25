import express from 'express';
import { getProfile, updateProfile } from '../../controllers/unit/unit-profile.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();
router.use('/profile', authenticateToken, (req, res, next) => (req.user.userUnitId ? next() : res.status(403).json({ success: false, message: 'Hanya untuk akun perawat' })));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;
