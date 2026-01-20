import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { supabase } from '../config/supabase.js';
import { haversine } from '../utils/haversine.js';

const router = express.Router();

// ================= CONFIG =================
const OFFICE_START = '07:30';
const OFFICE_END = '16:30';
const LATE_TOLERANCE_MINUTES = 10;

// helper
const minutesDiff = (a, b) =>
  Math.round((a - b) / 1000 / 60);

// =========================================
// CHECK IN
// =========================================
router.post(
  '/check-in',
  authMiddleware,
  upload.single('selfie'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { lat, lng } = req.body;
      const selfie = req.file;

      if (!lat || !lng || !selfie) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'lat, lng, and selfie are required' }
        });
      }

      // 1️⃣ lokasi aktif
      const { data: location, error: locError } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true)
        .single();

      if (locError) throw locError;

      // 2️⃣ jarak
      const distance = haversine(
        Number(lat),
        Number(lng),
        location.latitude,
        location.longitude
      );

      if (distance > location.radius_meter) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'OUTSIDE_RADIUS',
            message: 'You are outside attendance area',
            distance_meter: distance
          }
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      // 3️⃣ prevent double check-in
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('attendance_date', today)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_CHECKED_IN', message: 'Already checked in today' }
        });
      }

      // 4️⃣ insert attendance
      const checkInTime = new Date();
      const officeStartTime = new Date(`${today}T${OFFICE_START}:00`);

      const lateMinutes = Math.max(
        0,
        minutesDiff(checkInTime, officeStartTime)
      );

      const isLate = lateMinutes > LATE_TOLERANCE_MINUTES;

      const { data: attendance, error: insertError } = await supabase
        .from('attendance')
        .insert({
          user_id: userId,
          location_id: location.id,
          attendance_date: today,
          check_in_time: checkInTime.toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          check_in_distance_meter: distance,
          is_late: isLate,
          late_minutes: lateMinutes,
          status: isLate ? 'late' : 'present'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 5️⃣ upload selfie
      const path = `${userId}/${attendance.id}/checkin.jpg`;

      await supabase.storage
        .from('attendance-selfies')
        .upload(path, selfie.buffer, {
          contentType: selfie.mimetype,
          upsert: true
        });

      const { data: urlData } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(path);

      // 6️⃣ update selfie url
      await supabase
        .from('attendance')
        .update({ check_in_selfie_url: urlData.publicUrl })
        .eq('id', attendance.id);

      return res.status(201).json({
        success: true,
        data: {
          attendance_id: attendance.id,
          check_in_time: attendance.check_in_time,
          distance_meter: distance,
          is_late: isLate,
          late_minutes: lateMinutes,
          selfie_url: urlData.publicUrl,
          status: attendance.status
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message }
      });
    }
  }
);

// =========================================
// CHECK OUT
// =========================================
router.post(
  '/check-out',
  authMiddleware,
  upload.single('selfie'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { lat, lng } = req.body;
      const selfie = req.file;

      if (!lat || !lng || !selfie) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'lat, lng, and selfie are required' }
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      // 1️⃣ ambil attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('attendance_date', today)
        .single();

      if (!attendance) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_CHECKED_IN', message: 'No check-in today' }
        });
      }

      if (attendance.check_out_time) {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_CHECKED_OUT', message: 'Already checked out' }
        });
      }

      // 2️⃣ lokasi aktif
      const { data: location } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true)
        .single();

      // 3️⃣ jarak
      const distance = haversine(
        Number(lat),
        Number(lng),
        location.latitude,
        location.longitude
      );

      if (distance > location.radius_meter) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'OUTSIDE_RADIUS',
            message: 'You must checkout inside office',
            distance_meter: distance
          }
        });
      }

      const checkoutTime = new Date();
      const checkinTime = new Date(attendance.check_in_time);

      const workMinutes = minutesDiff(checkoutTime, checkinTime);

      const officeEndTime = new Date(`${today}T${OFFICE_END}:00`);
      const overtimeMinutes = Math.max(
        0,
        minutesDiff(checkoutTime, officeEndTime)
      );

      // 4️⃣ upload selfie
      const path = `${userId}/${attendance.id}/checkout.jpg`;

      await supabase.storage
        .from('attendance-selfies')
        .upload(path, selfie.buffer, {
          contentType: selfie.mimetype,
          upsert: true
        });

      const { data: urlData } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(path);

      const status =
        overtimeMinutes > 0 ? 'completed_overtime' : 'completed';

      // 5️⃣ update attendance
      const { data: updated } = await supabase
        .from('attendance')
        .update({
          check_out_time: checkoutTime.toISOString(),
          check_out_lat: lat,
          check_out_lng: lng,
          check_out_distance_meter: distance,
          check_out_selfie_url: urlData.publicUrl,
          work_minutes: workMinutes,
          overtime_minutes: overtimeMinutes,
          status
        })
        .eq('id', attendance.id)
        .select()
        .single();

      return res.status(200).json({
        success: true,
        data: {
          attendance_id: updated.id,
          check_in_time: updated.check_in_time,
          check_out_time: updated.check_out_time,
          work_minutes: updated.work_minutes,
          overtime_minutes: updated.overtime_minutes,
          selfie_url: urlData.publicUrl,
          status: updated.status
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message }
      });
    }
  }
);

export default router;
