import fastify from "../../src/utils/config/index.js";
import uploadRoutes from "../../src/routes/v1/upload.routes.js";

let registered = false;

export async function buildApp() {
  if (!registered) {
    await fastify.register(uploadRoutes, { prefix: "/v1" });
    registered = true;
  }
  await fastify.ready();
  return fastify;
}
