import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { listBast, getBast } from '../../controllers/rs/rs-bastLinenSewa.controller.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/bast-linen-sewa', listBast);
router.get('/bast-linen-sewa/:id', getBast);

export default router;
