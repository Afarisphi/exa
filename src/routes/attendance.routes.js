import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.post(
  '/check-in',
  authMiddleware,
  upload.single('selfie'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { lat, lng } = req.body;

      // 1️⃣ Validate input
      if (!lat || !lng || !req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'lat, lng, and selfie are required'
          }
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      // 2️⃣ Ambil lokasi kerja aktif
      const { data: location, error: locErr } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true)
        .single();

      if (locErr || !location) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_LOCATION',
            message: 'No active work location configured'
          }
        });
      }

      // 3️⃣ Cek sudah check-in hari ini?
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('attendance_date', today)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ALREADY_CHECKED_IN',
            message: 'You have already checked in today'
          }
        });
      }

      // 4️⃣ Insert attendance
      const { data: attendance, error } = await supabase
        .from('attendance')
        .insert({
          user_id: userId,
          location_id: location.id, // 🔥 FIX
          attendance_date: today,
          check_in_time: new Date().toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          status: 'present'
        })
        .select()
        .single();

      if (error) throw error;

      // 5️⃣ Response sukses
      return res.status(201).json({
        success: true,
        data: {
          attendance_id: attendance.id,
          attendance_date: today,
          check_in_time: attendance.check_in_time,
          location: {
            id: location.id,
            name: location.name
          },
          status: attendance.status
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to check in'
        }
      });
    }
  }
);

export default router;
