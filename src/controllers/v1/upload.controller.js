import { uploadSchema } from "../../schemas/v1/upload.schema.js";
import { testUpload } from "../../services/v1/upload.service.js";
import { prisma } from "../../prisma/client.js";

export async function uploadFile(req, res) {
    if (!req.isMultipart()) {
      req.logger.debug('Expected multipart/form-data');
      return res.status(400).send({ error: 'Expected multipart/form-data' });
    }
  
    const parts = req.parts();
    let fileCount = 0;
    let fileData = null;
    const fields = {};
  
    try {
      for await (const part of parts) {
        if (part.file) {
          fileCount++;
          if (fileCount > 1) {
            // descarte stream do arquivo extra para liberar memória
            await part.toBuffer();
            throw new Error('Expected single file, but multiple files uploaded');
          }
          // armazena o arquivo recebido
          const buffer = await part.toBuffer();
          fileData = {
            fieldname: part.fieldname,
            filename: part.filename,
            mimetype: part.mimetype,
            buffer,
          };
        } else {
          // parte de campos normais
          fields[part.fieldname] = part.value;
        }
      }
    } catch (err) {
      req.logger.debug(err.message);
      return res.status(400).send({ error: err.message });
    }
  
    if (fileCount === 0) {
      return res.status(400).send({ error: 'No file uploaded' });
    }
  
    let path = fields.path;
    if (!path) {
      return res.status(400).send({ error: 'Missing path field' });
    }
  
    req.logger.trace(`File received: "${fileData.filename}"`);
    req.logger.trace(`Buffer length: ${fileData.buffer.length}`);
  
    // check for user root
    req.logger.trace("Username: " + req.user.username);
    const user = await prisma.user.findUnique({ where: { username: req.user.username } });
    if (user.root_path) {
      req.logger.trace(`User root path: ${user.root_path}`);
      path = user.root_path + path;
    } else {
      req.logger.debug(`User root path not found for '${req.user.username}'`);
    }
    req.logger.debug(`Prepared upload path: ${path}`);

    const result = await testUpload(fileData.buffer, fileData.filename, path);
  
    return res.send({ message: 'File uploaded', result: result });
  }
  