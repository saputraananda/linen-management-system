import express from 'express';
import {
  getShortageTransactions,
  getShortageTransactionDetails,
  createShortageDelivery,
  getShortageDeliveries,
  getShortageDeliveryDetail
} from '../../controllers/ikm/kurangKirimCustom.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all IKM kurang kirim custom routes
router.use(authenticateToken);

router.get('/kurang-kirim-custom/transactions', getShortageTransactions);
router.get('/kurang-kirim-custom/transaction/:id/details', getShortageTransactionDetails);
router.post('/kurang-kirim-custom/delivery', createShortageDelivery);
router.get('/kurang-kirim-custom/deliveries', getShortageDeliveries);
router.get('/kurang-kirim-custom/delivery/:id', getShortageDeliveryDetail);

export default router;
