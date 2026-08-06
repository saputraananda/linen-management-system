import express from 'express';
import {
  getShortageTransactions,
  getShortageTransactionDetails,
  createShortageDelivery,
  getShortageDeliveries,
  getShortageDeliveryDetail
} from '../../controllers/ikm/kurangKirimKomersil.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all IKM kurang kirim komersil routes
router.use(authenticateToken);

router.get('/kurang-kirim-komersil/transactions', getShortageTransactions);
router.get('/kurang-kirim-komersil/transaction/:id/details', getShortageTransactionDetails);
router.post('/kurang-kirim-komersil/delivery', createShortageDelivery);
router.get('/kurang-kirim-komersil/deliveries', getShortageDeliveries);
router.get('/kurang-kirim-komersil/delivery/:id', getShortageDeliveryDetail);

export default router;
