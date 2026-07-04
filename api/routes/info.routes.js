import express from 'express';
import { getSystemInfo } from '../controllers/info.controller.js';

const router = express.Router();

// GET /api/info
router.get('/', getSystemInfo);

export default router;
