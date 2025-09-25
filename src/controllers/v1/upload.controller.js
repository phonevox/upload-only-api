import fs from "fs";
import path from "path";
import { prisma } from "../../prisma/client.js";
import { testUpload } from "../../services/v1/upload.service.js";

export async function uploadFile(req, res) {
  if (!req.isMultipart()) {
    req.logger.debug("Expected multipart/form-data");
    return res.status(400).send({ error: "Expected multipart/form-data" });
  }

  const parts = req.parts();
  let fileCount = 0;
  const fields = {};
  let tmpFilePath = null;
  let filename = null;

  const uploadDir = process.env.TMP_UPLOAD_DIR
    ? path.resolve(process.env.TMP_UPLOAD_DIR)
    : path.join(process.cwd(), "uploads");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  try {
    for await (const part of parts) {
      if (part.file) {
        fileCount++;
        if (fileCount > 1) {
          await part.toBuffer();
          throw new Error("Expected single file, but multiple files uploaded");
        }

        filename = part.filename;
        tmpFilePath = path.join(uploadDir, filename + ".tmp");

        const writeStream = fs.createWriteStream(tmpFilePath);
        let uploaded = 0;
        const total = Number(req.headers["content-length"]) || null;
        let uploadCompleted = false;

        await new Promise((resolve, reject) => {
          const cleanup = () => {
            if (!uploadCompleted && fs.existsSync(tmpFilePath)) {
              fs.unlinkSync(tmpFilePath);
              req.logger.debug(`Partial file removed due to abort: ${tmpFilePath}`);
            }
          };

          part.file.on("data", (chunk) => {
            uploaded += chunk.length;
            if (total) {
              const percent = ((uploaded / total) * 100).toFixed(2);
              req.logger.debug(
                `Progress: ${uploaded}/${total} bytes (chunk: ${chunk.length}B) (${percent}%)`
              );
            } else {
              req.logger.debug(`Progress: ${uploaded} bytes`);
            }
          });

          part.file.on("end", () => {
            req.logger.debug("File received (stream end)");
            uploadCompleted = true;
          });

          part.file.on("error", (err) => {
            cleanup();
            reject(err);
          });
          part.file.on("close", cleanup);

          writeStream.on("error", (err) => {
            cleanup();
            reject(err);
          });
          writeStream.on("close", cleanup);
          writeStream.on("finish", resolve);

          part.file.pipe(writeStream);
        });
      } else {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (err) {
    req.logger.debug(err.message);
    return res.status(400).send({ error: err.message });
  }

  if (fileCount === 0) {
    return res.status(400).send({ error: "No file uploaded" });
  }

  let uploadPath = fields.path;
  if (!uploadPath) {
    return res.status(400).send({ error: "Missing path field" });
  }

  req.logger.trace("Username: " + req.user.username);
  const user = await prisma.user.findUnique({ where: { username: req.user.username } });
  if (user.root_path) {
    req.logger.trace(`User root path: ${user.root_path}`);
    uploadPath = user.root_path + uploadPath;
  } else {
    req.logger.debug(`User root path not found for '${req.user.username}'`);
  }
  req.logger.debug(`Prepared upload path: ${uploadPath}`);

  // lê arquivo temporário e envia para testUpload
  const buffer = fs.readFileSync(tmpFilePath);
  const result = await testUpload(buffer, filename, uploadPath);

  // remove arquivo temporário após sucesso
  try {
    fs.unlinkSync(tmpFilePath);
    req.logger.debug(`Temporary file removed: ${tmpFilePath}`);
  } catch (err) {
    req.logger.warn(`Failed to remove temporary file: ${tmpFilePath} - ${err.message}`);
  }

  return res.send({ message: "File uploaded", result });
}
