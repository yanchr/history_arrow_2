export function errorHandler(err, req, res, next) {
  console.error('Error:', err)

  // Supabase errors
  if (err.code && err.message) {
    return res.status(400).json({
      error: err.message,
      code: err.code
    })
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message
    })
  }

  // Default error
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  })
}
