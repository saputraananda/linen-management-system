import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  requireRs, uploadPhotos, getOptions, getLinenOptions, listComplaints, getComplaint,
  createComplaint, updateComplaint, deleteComplaint, approveComplaint, rejectComplaint,
} from '../../controllers/rs/rs-complaintLinen.controller.js';

const router = express.Router();

router.use('/complaint', authenticateToken, requireRs);

router.get('/complaint/options', getOptions);
router.get('/complaint/linen-options', getLinenOptions);
router.get('/complaint', listComplaints);
router.get('/complaint/:id', getComplaint);
router.post('/complaint', uploadPhotos, createComplaint);
router.put('/complaint/:id', uploadPhotos, updateComplaint);
router.delete('/complaint/:id', deleteComplaint);
router.post('/complaint/:id/approve', approveComplaint);
router.post('/complaint/:id/reject', rejectComplaint);

export default router;
