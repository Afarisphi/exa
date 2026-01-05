import express from 'express';
import attendanceRoutes from './attendance.routes.js';

const router = express.Router();

router.use('/attendance', attendanceRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
