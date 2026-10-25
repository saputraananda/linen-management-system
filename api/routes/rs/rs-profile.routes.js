import express from 'express';
import { listUnitUsers, createUnitUser, updateUnitUser, toggleUnitUser, deleteUnitUser } from '../../controllers/rs/rs-profile.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();
router.use('/unit-users', authenticateToken, (req, res, next) => (req.user.role === 'rs' ? next() : res.status(403).json({ success: false, message: 'Akses ditolak' })));

router.get('/unit-users', listUnitUsers);
router.post('/unit-users', createUnitUser);
router.put('/unit-users/:id', updateUnitUser);
router.post('/unit-users/:id/toggle', toggleUnitUser);
router.delete('/unit-users/:id', deleteUnitUser);

export default router;
