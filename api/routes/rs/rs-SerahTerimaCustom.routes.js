import express from 'express';
import {
  getRSCustomTransactions,
  getRSCustomTransactionDetail,
  getRSCustomShortageDeliveryDetail
} from '../../controllers/rs/rs-SerahTerimaCustom.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all RS custom serah terima routes
router.use(authenticateToken);

// GET /api/rs/rs-serah-terima-custom/transactions - List all custom transactions for this hospital
router.get('/rs-serah-terima-custom/transactions', getRSCustomTransactions);

// GET /api/rs/rs-serah-terima-custom/transactions/:id - Get detail of a specific custom transaction
router.get('/rs-serah-terima-custom/transactions/:id', getRSCustomTransactionDetail);

// GET /api/rs/rs-serah-terima-custom/kurang-kirim/delivery/:id - Get detail of a specific custom shortage delivery
router.get('/rs-serah-terima-custom/kurang-kirim/delivery/:id', getRSCustomShortageDeliveryDetail);

export default router;
