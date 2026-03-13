const { getSecret } = require('../services/oauth');
const config = require('../config');
const pino = require('pino');

const logger = pino({ name: 'auth' });

let cachedAdminToken = null;
let tokenFetchedAt = 0;
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware that verifies the X-Admin-Token header against
 * the admin secret stored in Google Secret Manager.
 */
async function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({ error: 'Missing X-Admin-Token header' });
  }

  try {
    // Refresh cached token periodically
    const now = Date.now();
    if (!cachedAdminToken || now - tokenFetchedAt > TOKEN_CACHE_TTL) {
      cachedAdminToken = await getSecret(config.admin.secretName);
      tokenFetchedAt = now;
    }

    if (token !== cachedAdminToken) {
      logger.warn('Invalid admin token attempt');
      return res.status(403).json({ error: 'Invalid admin token' });
    }

    next();
  } catch (err) {
    logger.error({ err }, 'Failed to verify admin token');
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

module.exports = adminAuth;
