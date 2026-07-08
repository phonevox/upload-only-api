import fs from "fs";
import path from "path";
import crypto from "crypto";
import { pipeline } from "stream/promises";
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

  await fs.promises.mkdir(uploadDir, { recursive: true });

  const cleanupTmpFile = async () => {
    if (!tmpFilePath) return;
    try {
      await fs.promises.unlink(tmpFilePath);
      req.logger.debug(`Temporary file removed: ${tmpFilePath}`);
    } catch (err) {
      if (err.code !== "ENOENT") {
        req.logger.warn(`Failed to remove temporary file: ${tmpFilePath} - ${err.message}`);
      }
    }
  };

  try {
    try {
      for await (const part of parts) {
        if (part.file) {
          fileCount++;
          if (fileCount > 1) {
            await part.toBuffer();
            throw new Error("Expected single file, but multiple files uploaded");
          }

          filename = path.basename(part.filename);
          if (!filename || filename === "." || filename === "..") {
            throw new Error("Invalid filename");
          }
          tmpFilePath = path.join(uploadDir, `${crypto.randomUUID()}-${filename}.tmp`);

          let uploaded = 0;
          const total = Number(req.headers["content-length"]) || null;
          part.file.on("data", (chunk) => {
            uploaded += chunk.length;
            const progress = total ? `${uploaded}/${total} bytes (${((uploaded / total) * 100).toFixed(2)}%)` : `${uploaded} bytes`;
            req.logger.debug(`Progress: ${progress}`);
          });

          await pipeline(part.file, fs.createWriteStream(tmpFilePath));
          req.logger.debug("File received (stream end)");
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } catch (err) {
      req.logger.debug(err.message);
      await cleanupTmpFile();
      return res.status(400).send({ error: err.message });
    }

    if (fileCount === 0) {
      return res.status(400).send({ error: "No file uploaded" });
    }

    let uploadPath = fields.path;
    if (!uploadPath) {
      await cleanupTmpFile();
      return res.status(400).send({ error: "Missing path field" });
    }

    req.logger.trace("Username: " + req.user.username);
    const user = await prisma.user.findUnique({ where: { username: req.user.username } });
    if (user?.root_path) {
      req.logger.trace(`User root path: ${user.root_path}`);
      uploadPath = user.root_path + uploadPath;
    } else {
      req.logger.debug(`User root path not found for '${req.user.username}'`);
    }
    req.logger.debug(`Prepared upload path: ${uploadPath}`);

    const result = await testUpload(fs.createReadStream(tmpFilePath), filename, uploadPath);

    // cleaned up before responding so the temp file is guaranteed gone by the time
    // the client sees a 200 (fastify can finish sending the reply before code after
    // res.send() in this same handler finishes running)
    await cleanupTmpFile();
    return res.send({ message: "File uploaded", result });
  } finally {
    await cleanupTmpFile();
  }
}
