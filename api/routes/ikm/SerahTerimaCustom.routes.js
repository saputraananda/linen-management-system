import express from 'express';
import {
  getCustomTransactions,
  getCustomTransactionDetail,
  createCustomTransaction,
  updateCustomTransactionDelivery,
  getHospitalLinenCustom,
  getIkmEmployees
} from '../../controllers/ikm/SerahTerimaCustom.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware
router.use(authenticateToken);

// GET /api/ikm/hospital-linen-custom - Get hospital linen items for category 33
router.get('/hospital-linen-custom', getHospitalLinenCustom);

// GET /api/ikm/transactions-custom - List all custom transactions (category 33)
router.get('/transactions-custom', getCustomTransactions);

// GET /api/ikm/transactions-custom/:id - Get detail of a custom transaction
router.get('/transactions-custom/:id', getCustomTransactionDetail);

// POST /api/ikm/transactions-custom - Create new custom transaction (Pickup kotor)
router.post('/transactions-custom', createCustomTransaction);

// PUT /api/ikm/transactions-custom/:id - Complete custom transaction delivery (Delivery bersih)
router.put('/transactions-custom/:id', updateCustomTransactionDelivery);

// GET /api/ikm/employees-custom - Get list of IKM employees
router.get('/employees-custom', getIkmEmployees);

export default router;
