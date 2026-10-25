import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  requireUnit, uploadPhotos, getOptions, getLinenOptions, listComplaints, getComplaint,
  createComplaint, updateComplaint, deleteComplaint,
} from '../../controllers/unit/unit-complaint.controller.js';

const router = express.Router();

// Guard dibatasi ke /complaint agar tidak memengaruhi route lain di prefix /api/unit
router.use('/complaint', authenticateToken, requireUnit);

router.get('/complaint/options', getOptions);
router.get('/complaint/linen-options', getLinenOptions);
router.get('/complaint', listComplaints);
router.get('/complaint/:id', getComplaint);
router.post('/complaint', uploadPhotos, createComplaint);
router.put('/complaint/:id', uploadPhotos, updateComplaint);
router.delete('/complaint/:id', deleteComplaint);

export default router;
