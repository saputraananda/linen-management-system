import express from 'express';

const router = express.Router();

const NOTIFY_SECRET =
  process.env.LINEN_MONITORING_NOTIFY_SECRET ||
  process.env.INTERNAL_NOTIFY_SECRET ||
  'alora-linen-notify';

/**
 * POST /api/internal/socket-notify
 * Bridge dari Alsa (atau service lain) → broadcast Socket.IO ke room hospital.
 * Body: { hospitalId, type?, message? }
 * Header: x-notify-secret
 */
router.post('/socket-notify', (req, res) => {
  const secret = req.headers['x-notify-secret'];
  if (!secret || secret !== NOTIFY_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const hospitalId = req.body?.hospitalId ?? req.body?.hospital_id;
  if (!hospitalId) {
    return res.status(400).json({ success: false, message: 'hospitalId wajib' });
  }

  const type = req.body?.type || 'HOSPITAL_LINEN_MASTER';
  const message = req.body?.message || 'Master linen RS diperbarui';

  const io = req.app.get('io');
  if (!io) {
    return res.status(503).json({ success: false, message: 'Socket.io belum siap' });
  }

  io.to(`hospital_${hospitalId}`).emit('data_changed', { type, message, hospitalId: Number(hospitalId) });

  return res.json({ success: true });
});

export default router;
