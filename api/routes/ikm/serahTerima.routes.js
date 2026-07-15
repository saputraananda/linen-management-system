import express from 'express';
import { 
  getTransactions, 
  getTransactionDetail, 
  createTransaction, 
  updateTransactionDelivery,
  getIkmEmployees
} from '../../controllers/ikm/serahTerima.controller.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to protect all IKM serah terima routes
router.use(authenticateToken);

// GET /api/ikm/transactions - List all transactions for a hospital
router.get('/transactions', getTransactions);

// GET /api/ikm/transactions/:id - Get detail of a specific transaction
router.get('/transactions/:id', getTransactionDetail);

// POST /api/ikm/transactions - Create new transaction (Pickup kotor)
router.post('/transactions', createTransaction);

// PUT /api/ikm/transactions/:id - Complete transaction delivery (Delivery bersih)
router.put('/transactions/:id', updateTransactionDelivery);

// GET /api/ikm/employees - Get list of IKM employees
router.get('/employees', getIkmEmployees);

export default router;
