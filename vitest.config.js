import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/utils/jwt/buffer-polyfill.js"],
  },
});
