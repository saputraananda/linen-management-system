import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import {
  getSenderDefault,
  getFormLinens,
  listBast,
  getBast,
  createBast,
  updateBast,
  updateLineSpecs,
  deleteBast,
} from '../../controllers/ikm/bastLinenSewa.controller.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/bast-linen-sewa/me', getSenderDefault);
router.get('/bast-linen-sewa/linens', getFormLinens);
router.get('/bast-linen-sewa', listBast);
router.get('/bast-linen-sewa/:id', getBast);
router.post('/bast-linen-sewa', createBast);
router.put('/bast-linen-sewa/:id', updateBast);
router.patch('/bast-linen-sewa/:id/lines', updateLineSpecs);
router.delete('/bast-linen-sewa/:id', deleteBast);

export default router;
