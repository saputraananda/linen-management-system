import express from 'express';
import {
  getShortageTransactions,
  getShortageTransactionDetails,
  createShortageDelivery,
  getShortageDeliveries,
  getShortageDeliveryDetail
} from '../../controllers/ikm/kurangKirimLinen.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all IKM kurang kirim routes
router.use(authenticateToken);

router.get('/kurang-kirim-linen/transactions', getShortageTransactions);
router.get('/kurang-kirim-linen/transaction/:id/details', getShortageTransactionDetails);
router.post('/kurang-kirim-linen/delivery', createShortageDelivery);
router.get('/kurang-kirim-linen/deliveries', getShortageDeliveries);
router.get('/kurang-kirim-linen/delivery/:id', getShortageDeliveryDetail);

export default router;
