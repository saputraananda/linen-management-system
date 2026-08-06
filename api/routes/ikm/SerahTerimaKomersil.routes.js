import express from 'express';
import {
  getKomersilTransactions,
  getKomersilTransactionDetail,
  createKomersilTransaction,
  updateKomersilTransactionDelivery,
  getHospitalLinenKomersil,
  getIkmEmployees
} from '../../controllers/ikm/SerahTerimaKomersil.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticateToken);

// GET /api/ikm/hospital-linen-komersil - Get hospital linen items for category 33
router.get('/hospital-linen-komersil', getHospitalLinenKomersil);

// GET /api/ikm/transactions-komersil - List all komersil transactions (category 33)
router.get('/transactions-komersil', getKomersilTransactions);

// GET /api/ikm/transactions-komersil/:id - Get detail of a komersil transaction
router.get('/transactions-komersil/:id', getKomersilTransactionDetail);

// POST /api/ikm/transactions-komersil - Create new komersil transaction (Pickup kotor)
router.post('/transactions-komersil', createKomersilTransaction);

// PUT /api/ikm/transactions-komersil/:id - Complete komersil transaction delivery (Delivery bersih)
router.put('/transactions-komersil/:id', updateKomersilTransactionDelivery);

// GET /api/ikm/employees-komersil - Get list of IKM employees
router.get('/employees-komersil', getIkmEmployees);

export default router;
