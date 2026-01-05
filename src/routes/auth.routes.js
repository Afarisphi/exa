import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/dev-login', (req, res) => {
  const { id, email } = req.body;

  if (!id || !email) {
    return res.status(400).json({
      success: false,
      message: 'id and email required'
    });
  }

  const token = jwt.sign(
    { id, email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({
    success: true,
    token
  });
});

export default router;
