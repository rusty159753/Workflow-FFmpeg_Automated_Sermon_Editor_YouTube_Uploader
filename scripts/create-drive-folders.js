#!/usr/bin/env node

/**
 * One-time script to create the Google Drive folder structure for ASP.
 *
 * Creates:
 *   ASP/
 *   ├── Assets/
 *   │   ├── Intro/
 *   │   └── Outro/
 *   ├── Output/
 *   └── Logs/
 *
 * Usage:
 *   node scripts/create-drive-folders.js --project-id=<GCP_PROJECT>
 *
 * Outputs the folder IDs to paste into api/config.yaml.
 */

const { google } = require('googleapis');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    args[key] = rest.join('=');
  });
  if (!args['project-id']) {
    console.error('Usage: node create-drive-folders.js --project-id=<GCP_PROJECT>');
    process.exit(1);
  }
  return args;
}

async function getSecret(smClient, projectId, secretName) {
  const [version] = await smClient.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    },
    fields: 'id, name',
  });
  return res.data;
}

async function main() {
  const args = parseArgs();
  const projectId = args['project-id'];

  console.log('\n=== ASP Drive Folder Setup ===\n');
  console.log('Fetching OAuth credentials from Secret Manager...');

  const smClient = new SecretManagerServiceClient();
  const clientId = await getSecret(smClient, projectId, 'oauth-client-id');
  const clientSecret = await getSecret(smClient, projectId, 'oauth-client-secret');
  const refreshToken = await getSecret(smClient, projectId, 'oauth-refresh-token');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  console.log('Creating folder structure...\n');

  // Create root folder
  const root = await createFolder(drive, 'ASP');
  console.log(`  ASP/                  -> ${root.id}`);

  // Create subfolders
  const assets = await createFolder(drive, 'Assets', root.id);
  console.log(`  ASP/Assets/           -> ${assets.id}`);

  const intro = await createFolder(drive, 'Intro', assets.id);
  console.log(`  ASP/Assets/Intro/     -> ${intro.id}`);

  const outro = await createFolder(drive, 'Outro', assets.id);
  console.log(`  ASP/Assets/Outro/     -> ${outro.id}`);

  const output = await createFolder(drive, 'Output', root.id);
  console.log(`  ASP/Output/           -> ${output.id}`);

  const logs = await createFolder(drive, 'Logs', root.id);
  console.log(`  ASP/Logs/             -> ${logs.id}`);

  console.log('\n=== Add these to api/config.yaml ===\n');
  console.log('drive:');
  console.log(`  root_folder_id: "${root.id}"`);
  console.log(`  intro_folder_id: "${intro.id}"`);
  console.log(`  outro_folder_id: "${outro.id}"`);
  console.log(`  output_folder_id: "${output.id}"`);
  console.log(`  logs_folder_id: "${logs.id}"`);
  console.log('');
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
