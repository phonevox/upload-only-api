import { uploadFile } from "../../controllers/v1/upload.controller.js";
import multipart from '@fastify/multipart'
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { Roles } from "../../enums/index.js";

export default async function uploadRoutes(fastify, opts) {
    await fastify.register(multipart);  // shouldnt be here?
    fastify.post('/upload', {
        onRequest: [requireAuth],
        handler: uploadFile
    })
}