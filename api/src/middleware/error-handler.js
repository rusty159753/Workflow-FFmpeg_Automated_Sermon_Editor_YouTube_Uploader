const pino = require('pino');

const logger = pino({ name: 'error-handler' });

/**
 * Central Express error handler.
 * Catches all unhandled errors and returns a sanitized JSON response.
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;

  logger.error({
    err,
    method: req.method,
    url: req.url,
    statusCode,
  }, 'Request error');

  // Don't leak internal details in production
  const message = statusCode >= 500
    ? 'Internal server error'
    : err.message || 'An error occurred';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
