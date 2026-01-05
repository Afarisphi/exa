export function errorMiddleware(err, req, res, next) {
  console.error(err);

  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: err.message || 'Internal server error'
    }
  });
}
