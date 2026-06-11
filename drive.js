import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import dotenv from 'dotenv';
dotenv.config();

import { authenticate }
  from '@google-cloud/local-auth';

import { google } from 'googleapis';

const SCOPES = [
  //'https://www.googleapis.com/auth/drive.file'
  'https://www.googleapis.com/auth/drive'
];

const TOKEN_PATH =
  path.join(process.cwd(), 'token.json');

const CREDENTIALS_PATH =
  path.join(process.cwd(), 'credentials.json');

/******************************************************************************* */
async function loadSavedCredentialsIfExist() {

  try {
    const content =
      await fs.promises.readFile(TOKEN_PATH);

    const credentials =
      JSON.parse(content);

    return google.auth.fromJSON(credentials);

  } catch (err) {
    return null;
  }
}

/******************************************************************************* */
async function saveCredentials(client) {

  const content =
    await fs.promises.readFile(
      CREDENTIALS_PATH
    );

  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  });

  await fs.promises.writeFile(
    TOKEN_PATH,
    payload
  );
}



/******************************************************************************* */
async function authorize() {

  try {

    if (
      process.env.GOOGLE_CREDENTIALS &&
      process.env.GOOGLE_TOKEN
    ) {

      const credentials = JSON.parse(
        process.env.GOOGLE_CREDENTIALS
      );

      const token = JSON.parse(
        process.env.GOOGLE_TOKEN
      );

      const key =
        credentials.installed ||
        credentials.web;

      const oauth2Client =
        new google.auth.OAuth2(
          key.client_id,
          key.client_secret,
          key.redirect_uris?.[0] || 'http://localhost'
        );

      oauth2Client.setCredentials(token);

      return oauth2Client;
    }

    // fallback locale
    let client =
      await loadSavedCredentialsIfExist();

    if (client) return client;

    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH
    });

    if (client.credentials) {
      await saveCredentials(client);
    }

    return client;

  } catch (err) {
    console.error("AUTH ERROR:", err);
    throw err;
  }
}


/******************************************************************************* */
// fileId = ID del file XLSX su Google Drive
export async function loadWorkbookFromDrive(fileId) {

  const auth = await authorize();
  const drive = google.drive({
    version: 'v3',
    auth
  });

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media'
    },
    {
      responseType: 'arraybuffer'
    }
  );

  return Buffer.from(response.data);
}

/******************************************************************************* */
export async function uploadToGoogleDrive(
  filepath,
  filename
) {

  const auth = await authorize();
  const drive = google.drive({
    version: 'v3',
    auth
  });
  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [
        process.env.GOOGLE_DRIVE_FOLDER_ID
      ]
    },
    media: {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: fs.createReadStream(filepath)
    },
    fields: 'id,name'
  });

  console.log('Upload completato');
  console.log(response.data);

  return response.data;
}

/******************************************************************************* */
export async function updateFileOnDrive(fileId, buffer) {

  const auth = await authorize();
  const drive = google.drive({
    version: 'v3',
    auth
  });
  
  const response = await drive.files.update({
    fileId,
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(buffer)
    },
    fields: 'id,name,modifiedTime'
  });

  return response.data;
}