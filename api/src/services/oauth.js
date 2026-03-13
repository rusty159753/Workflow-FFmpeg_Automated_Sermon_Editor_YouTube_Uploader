const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { google } = require('googleapis');
const pino = require('pino');
const config = require('../config');

const logger = pino({ name: 'oauth' });
const smClient = new SecretManagerServiceClient();

let cachedAuth = null;
let tokenExpiresAt = 0;

async function getSecret(secretName) {
  const projectId = config.gcpProjectId;
  const [version] = await smClient.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

/**
 * Returns an authenticated OAuth2 client with fresh access token.
 * Caches the client and refreshes the token when it expires.
 */
async function getAuthClient() {
  const now = Date.now();

  if (cachedAuth && now < tokenExpiresAt - 60000) {
    return cachedAuth;
  }

  logger.info('Refreshing OAuth2 credentials...');

  const clientId = await getSecret(config.secrets.oauthClientId);
  const clientSecret = await getSecret(config.secrets.oauthClientSecret);
  const refreshToken = await getSecret(config.secrets.oauthRefreshToken);

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Force a token refresh to get the expiry time
  const { token, res } = await oauth2Client.getAccessToken();
  if (res && res.data && res.data.expiry_date) {
    tokenExpiresAt = res.data.expiry_date;
  } else {
    // Default to 50 minutes from now
    tokenExpiresAt = now + 50 * 60 * 1000;
  }

  cachedAuth = oauth2Client;
  logger.info('OAuth2 credentials refreshed successfully');
  return cachedAuth;
}

/**
 * Returns an authenticated Google Drive API client.
 */
async function getDriveClient() {
  const auth = await getAuthClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Returns an authenticated YouTube API client.
 */
async function getYouTubeClient() {
  const auth = await getAuthClient();
  return google.youtube({ version: 'v3', auth });
}

module.exports = { getAuthClient, getDriveClient, getYouTubeClient, getSecret };
