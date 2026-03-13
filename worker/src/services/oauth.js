const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { google } = require('googleapis');
const pino = require('pino');

const logger = pino({ name: 'worker-oauth' });
const smClient = new SecretManagerServiceClient();

let cachedAuth = null;

async function getSecret(secretName) {
  const projectId = process.env.GCP_PROJECT_ID;
  const [version] = await smClient.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

async function getAuthClient() {
  if (cachedAuth) return cachedAuth;

  logger.info('Loading OAuth credentials...');
  const clientId = await getSecret('oauth-client-id');
  const clientSecret = await getSecret('oauth-client-secret');
  const refreshToken = await getSecret('oauth-refresh-token');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  cachedAuth = oauth2Client;
  return cachedAuth;
}

async function getDriveClient() {
  const auth = await getAuthClient();
  return google.drive({ version: 'v3', auth });
}

async function getYouTubeClient() {
  const auth = await getAuthClient();
  return google.youtube({ version: 'v3', auth });
}

module.exports = { getAuthClient, getDriveClient, getYouTubeClient };
