import express from 'express';
import {
  getTransactions,
  getTransactionDetail,
  getShortageDeliveryDetail
} from '../../controllers/rs/rs-serahTerima.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all RS serah terima routes
router.use(authenticateToken);

// GET /api/rs/transactions - List all transactions for this hospital
router.get('/transactions', getTransactions);

// GET /api/rs/transactions/:id - Get detail of a specific transaction
router.get('/transactions/:id', getTransactionDetail);

// GET /api/rs/kurang-kirim-linen/delivery/:id - Get detail of a specific waybill
router.get('/kurang-kirim-linen/delivery/:id', getShortageDeliveryDetail);

export default router;
