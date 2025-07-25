import { google } from 'googleapis';
import { PassThrough } from 'stream';
import { logging } from '../../utils/logging/index.js'

const logger = logging.getLogger(process.env.LOGGING_BASE_NAME + '.services.v1.upload.service')

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
})

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
})

function generateStreamFromBuffer(buffer) {
    const stream = new PassThrough();
    stream.end(buffer);
    return stream;
}

export async function uploadToDrive(buffer, filename, path) {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 'root';

    // Função auxiliar para buscar/criar pasta no Drive pelo nome e parentId
    async function getOrCreateFolder(folderName, parentId) {
        const res = await drive.files.list({
            q: `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (res.data.files.length > 0) {
            return res.data.files[0].id;
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };

        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });

        return folder.data.id;
    }

    // obtendo o parentId a partir do path, criando as pastas se necessário (quase como um upsert)
    const folders = path.split('/').filter(Boolean);
    let parentId = rootFolderId;

    for (const folderName of folders) {
        parentId = await getOrCreateFolder(folderName, parentId);
    }

    // upa o arquivo
    const response = await drive.files.create({
        resource: {
            name: filename,
            parents: [parentId],
        },
        media: {
            mimeType: 'application/octet-stream',
            body: generateStreamFromBuffer(buffer),
        },
        fields: 'id, name',
    });

    return response.data; // id, name etc
}

export async function testUpload(buffer, filename, path) {
    logger.info(`Uploading '${filename}' to '${path}'`)
    const result = await uploadToDrive(buffer, filename, path);
    logger.debug(`Uploaded '${result.name}', id '${result.id}'`);
    logger.trace(result)

    // padronizando como array de objetos, mesmo que a gente só faça upload de um arquivo por vez :)
    return [{
        id: result.id,
        path: `${path.replace(/^\//, '')}/${filename}`
    }]
}