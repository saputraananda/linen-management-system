import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  requireIkm, getAccess, listComplaints, getComplaint, updateStatus,
} from '../../controllers/ikm/complaintLinen.controller.js';

const router = express.Router();

router.use('/complaint', authenticateToken, requireIkm);

router.get('/complaint/access', getAccess);
router.get('/complaint', listComplaints);
router.get('/complaint/:id', getComplaint);
router.post('/complaint/:id/status', updateStatus);

export default router;
