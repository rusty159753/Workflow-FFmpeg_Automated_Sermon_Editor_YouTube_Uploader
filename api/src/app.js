const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');

function createApp() {
  const app = express();

  app.use(helmet());

  app.use(cors({
    origin: config.frontend.origin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Token'],
  }));

  app.use(express.json({ limit: '1mb' }));

  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  }));

  // Routes
  app.use('/api', require('./routes/upload'));
  app.use('/api', require('./routes/jobs'));
  app.use('/api/admin', require('./routes/admin'));

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Error handler
  app.use(require('./middleware/error-handler'));

  return app;
}

module.exports = createApp;
