import { createRequire } from "node:module";
import { Buffer } from "node:buffer";

// jsonwebtoken -> jws -> jwa depends on buffer-equal-constant-time, an abandoned
// package that reads buffer.SlowBuffer at require-time. Newer Node removed it.
// Buffer already implements .equal(), so it's a safe stand-in. No-op wherever
// SlowBuffer still exists (e.g. Node 22, the Docker image this app deploys on).
const bufferModule = createRequire(import.meta.url)("buffer");
if (!bufferModule.SlowBuffer) {
    bufferModule.SlowBuffer = Buffer;
}
