import { handleCheckIn } from '../services/attendance.service.js';

export async function checkIn(req, res, next) {
  try {
    const result = await handleCheckIn({
      user: req.user,
      lat: req.body.lat,
      lng: req.body.lng,
      file: req.file
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}
