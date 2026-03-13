#!/usr/bin/env node

/**
 * One-time OAuth 2.0 setup script.
 *
 * Usage:
 *   node scripts/setup-oauth.js --client-id=<ID> --client-secret=<SECRET> --project-id=<GCP_PROJECT>
 *
 * This script:
 * 1. Opens a browser for the admin to consent to YouTube + Drive scopes.
 * 2. Captures the authorization code via a local redirect.
 * 3. Exchanges the code for a refresh token.
 * 4. Stores the refresh token, client ID, and client secret in Google Secret Manager.
 */

const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/drive.file',
];

const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    args[key] = rest.join('=');
  });
  if (!args['client-id'] || !args['client-secret'] || !args['project-id']) {
    console.error('Usage: node setup-oauth.js --client-id=<ID> --client-secret=<SECRET> --project-id=<GCP_PROJECT>');
    process.exit(1);
  }
  return args;
}

async function storeSecret(client, projectId, secretId, value) {
  const parent = `projects/${projectId}`;

  // Create the secret if it doesn't exist
  try {
    await client.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
    console.log(`  Created secret: ${secretId}`);
  } catch (err) {
    if (err.code === 6) { // ALREADY_EXISTS
      console.log(`  Secret already exists: ${secretId}`);
    } else {
      throw err;
    }
  }

  // Add the secret version
  await client.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: { data: Buffer.from(value, 'utf8') },
  });
  console.log(`  Stored new version for: ${secretId}`);
}

async function main() {
  const args = parseArgs();
  const clientId = args['client-id'];
  const clientSecret = args['client-secret'];
  const projectId = args['project-id'];

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n=== ASP OAuth Setup ===\n');
  console.log('Open the following URL in your browser to authorize:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...\n');

  // Open browser automatically on supported platforms
  const openCmd = process.platform === 'win32' ? 'start' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  require('child_process').exec(`${openCmd} "${authUrl}"`);

  // Start local server to capture the callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname === '/callback') {
        const authCode = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Authorization Failed</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization Successful!</h1><p>You can close this window.</p>');
        server.close();
        resolve(authCode);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Listening for callback on port ${REDIRECT_PORT}...`);
    });
  });

  console.log('Authorization code received. Exchanging for tokens...\n');

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error('ERROR: No refresh token received. You may need to revoke access and try again.');
    console.error('Go to https://myaccount.google.com/permissions and remove the app, then re-run.');
    process.exit(1);
  }

  console.log('Tokens received. Storing in Secret Manager...\n');

  const smClient = new SecretManagerServiceClient();

  await storeSecret(smClient, projectId, 'oauth-client-id', clientId);
  await storeSecret(smClient, projectId, 'oauth-client-secret', clientSecret);
  await storeSecret(smClient, projectId, 'oauth-refresh-token', tokens.refresh_token);

  console.log('\n=== Setup Complete ===');
  console.log('All secrets stored in Google Secret Manager.');
  console.log('You can now deploy the API service and worker.\n');
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
