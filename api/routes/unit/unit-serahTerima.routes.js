import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireUnit } from '../../controllers/unit/unit-complaint.controller.js';
import {
  getUnitTransactions,
  getUnitTransactionDetail,
  getUnitShortageDeliveryDetail
} from '../../controllers/unit/unit-serahTerima.controller.js';

const router = express.Router();

// Guard dibatasi ke prefix serah-terima agar tidak memengaruhi route lain di /api/unit
router.use('/serah-terima', authenticateToken, requireUnit);

// GET /api/unit/serah-terima/transactions - riwayat serah terima linen unit yang sedang login
router.get('/serah-terima/transactions', getUnitTransactions);
// GET /api/unit/serah-terima/transactions/:id
router.get('/serah-terima/transactions/:id', getUnitTransactionDetail);
// GET /api/unit/serah-terima/kurang-kirim/delivery/:id
router.get('/serah-terima/kurang-kirim/delivery/:id', getUnitShortageDeliveryDetail);

export default router;
