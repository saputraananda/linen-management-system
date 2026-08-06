import express from 'express';
import {
  getRSKomersilTransactions,
  getRSKomersilTransactionDetail,
  getRSKomersilShortageDeliveryDetail
} from '../../controllers/rs/rs-serahTerimaKomersil.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all RS komersil serah terima routes
router.use(authenticateToken);

// GET /api/rs/rs-serah-terima-komersil/transactions - List all komersil transactions for this hospital
router.get('/rs-serah-terima-komersil/transactions', getRSKomersilTransactions);

// GET /api/rs/rs-serah-terima-komersil/transactions/:id - Get detail of a specific komersil transaction
router.get('/rs-serah-terima-komersil/transactions/:id', getRSKomersilTransactionDetail);

// GET /api/rs/rs-serah-terima-komersil/kurang-kirim/delivery/:id - Get detail of a specific komersil shortage delivery
router.get('/rs-serah-terima-komersil/kurang-kirim/delivery/:id', getRSKomersilShortageDeliveryDetail);

export default router;
