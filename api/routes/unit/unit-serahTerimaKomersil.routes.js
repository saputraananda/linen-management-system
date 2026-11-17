import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireUnit } from '../../controllers/unit/unit-complaint.controller.js';
import {
  getUnitKomersilTransactions,
  getUnitKomersilTransactionDetail,
  getUnitKomersilShortageDeliveryDetail
} from '../../controllers/unit/unit-serahTerimaKomersil.controller.js';

const router = express.Router();

// Guard dibatasi ke prefix serah-terima-komersil agar tidak memengaruhi route lain di /api/unit
router.use('/serah-terima-komersil', authenticateToken, requireUnit);

router.get('/serah-terima-komersil/transactions', getUnitKomersilTransactions);
router.get('/serah-terima-komersil/transactions/:id', getUnitKomersilTransactionDetail);
router.get('/serah-terima-komersil/kurang-kirim/delivery/:id', getUnitKomersilShortageDeliveryDetail);

export default router;
