import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import jwt from "jsonwebtoken";

vi.mock("../../prisma/client.js", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("../../services/v1/upload.service.js", () => ({
  testUpload: vi.fn(),
}));

import { prisma } from "../../prisma/client.js";
import { testUpload } from "../../services/v1/upload.service.js";
import { buildApp } from "../../../test/helpers/build-app.js";
import { buildMultipart } from "../../../test/helpers/multipart.js";

const JWT_SECRET = "test-secret";
const TEST_USERNAME = "tester";

let app;
let TEST_TOKEN;
let tmpUploadDir;

function authHeader() {
  return { authorization: `Bearer ${TEST_TOKEN}` };
}

function uploadedFiles() {
  return fs.readdirSync(tmpUploadDir);
}

// a real Drive call reads the stream to completion before resolving; mimic that here so the
// mock doesn't leave a dangling fs read handle racing our own temp-file cleanup in tests
function discardStream(stream) {
  stream.on("error", () => {});
  stream.destroy();
}

function inject(payload) {
  return app.inject({
    method: "POST",
    url: "/v1/upload",
    headers: { ...authHeader(), "content-type": payload.contentType },
    payload: payload.body,
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  TEST_TOKEN = jwt.sign({ username: TEST_USERNAME, role: "user" }, JWT_SECRET);
  app = await buildApp();
});

beforeEach(() => {
  tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "uoe-test-"));
  process.env.TMP_UPLOAD_DIR = tmpUploadDir;

  prisma.user.findUnique.mockReset();
  prisma.user.findUnique.mockImplementation(async ({ where }) => {
    if (where.token === TEST_TOKEN) {
      return { id: 1, username: TEST_USERNAME, role: "user" };
    }
    if (where.username === TEST_USERNAME) {
      return { username: TEST_USERNAME, root_path: null };
    }
    return null;
  });

  testUpload.mockReset();
  testUpload.mockImplementation(async (stream) => {
    discardStream(stream);
    return [{ id: "fake-drive-id", path: "x/hello.txt" }];
  });
});

afterEach(() => {
  fs.rmSync(tmpUploadDir, { recursive: true, force: true });
});

describe("POST /v1/upload", () => {
  it("rejects non-multipart requests", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/upload",
      headers: { ...authHeader(), "content-type": "application/json" },
      payload: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects when no file is sent", async () => {
    const res = await inject(buildMultipart([{ type: "field", name: "path", value: "/x" }]));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("No file uploaded");
  });

  it("uploads a valid file successfully and cleans up the temp file", async () => {
    const res = await inject(
      buildMultipart([
        { type: "field", name: "path", value: "/reports" },
        { type: "file", name: "file", filename: "hello.txt", value: "hello world" },
      ])
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe("File uploaded");

    expect(testUpload).toHaveBeenCalledTimes(1);
    const [streamArg, filenameArg, pathArg] = testUpload.mock.calls[0];
    expect(filenameArg).toBe("hello.txt");
    expect(pathArg).toBe("/reports");

    // item 8: streamed to Drive, never buffered fully in memory
    expect(typeof streamArg.pipe).toBe("function");
    expect(Buffer.isBuffer(streamArg)).toBe(false);

    expect(uploadedFiles()).toEqual([]);
  });

  it("sanitizes path-traversal filenames (item 1)", async () => {
    const res = await inject(
      buildMultipart([
        { type: "field", name: "path", value: "/x" },
        { type: "file", name: "file", filename: "../../../evil.txt", value: "pwned" },
      ])
    );

    expect(res.statusCode).toBe(200);
    const [, filenameArg] = testUpload.mock.calls[0];
    expect(filenameArg).toBe("evil.txt");
    expect(uploadedFiles()).toEqual([]);
  });

  it("cleans up the temp file when the Drive upload fails (item 3)", async () => {
    testUpload.mockImplementationOnce(async (stream) => {
      discardStream(stream);
      throw new Error("invalid_grant");
    });

    const res = await inject(
      buildMultipart([
        { type: "field", name: "path", value: "/x" },
        { type: "file", name: "file", filename: "hello.txt", value: "hello world" },
      ])
    );

    expect(res.statusCode).toBe(500);
    expect(uploadedFiles()).toEqual([]);
  });

  it("cleans up the temp file when the path field is missing (item 4)", async () => {
    const res = await inject(
      buildMultipart([{ type: "file", name: "file", filename: "hello.txt", value: "hello world" }])
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("Missing path field");
    expect(uploadedFiles()).toEqual([]);
  });

  it("cleans up the first file's temp when a second file is rejected (item 5)", async () => {
    const res = await inject(
      buildMultipart([
        { type: "field", name: "path", value: "/x" },
        { type: "file", name: "file1", filename: "file1.txt", value: "one" },
        { type: "file", name: "file2", filename: "file2.txt", value: "two" },
      ])
    );

    expect(res.statusCode).toBe(400);
    expect(uploadedFiles()).toEqual([]);
  });

  it("does not crash and still cleans up when the user record is missing (item 6)", async () => {
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.token === TEST_TOKEN) return { id: 1, username: TEST_USERNAME, role: "user" };
      return null; // user vanished from DB between auth and the upload lookup
    });

    const res = await inject(
      buildMultipart([
        { type: "field", name: "path", value: "/x" },
        { type: "file", name: "file", filename: "hello.txt", value: "hello world" },
      ])
    );

    expect(res.statusCode).toBe(200);
    expect(uploadedFiles()).toEqual([]);
  });

  it("still returns success when removing the temp file fails after a successful upload (item 9)", async () => {
    const unlinkSpy = vi.spyOn(fs.promises, "unlink").mockRejectedValueOnce(new Error("EBUSY"));

    const res = await inject(
      buildMultipart([
        { type: "field", name: "path", value: "/x" },
        { type: "file", name: "file", filename: "hello.txt", value: "hello world" },
      ])
    );

    expect(res.statusCode).toBe(200);
    unlinkSpy.mockRestore();
  });

  it("handles two concurrent uploads with the same filename without corrupting either (item 2)", async () => {
    const payloadA = buildMultipart([
      { type: "field", name: "path", value: "/x" },
      { type: "file", name: "file", filename: "same.txt", value: "content-A" },
    ]);
    const payloadB = buildMultipart([
      { type: "field", name: "path", value: "/x" },
      { type: "file", name: "file", filename: "same.txt", value: "content-B" },
    ]);

    const [resA, resB] = await Promise.all([inject(payloadA), inject(payloadB)]);

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
    expect(uploadedFiles()).toEqual([]);
  });
});
