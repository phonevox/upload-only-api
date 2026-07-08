import { describe, it, expect, vi, beforeEach } from "vitest";

const { filesList, filesCreate, oauth2SetCredentials } = vi.hoisted(() => ({
  filesList: vi.fn(),
  filesCreate: vi.fn(),
  oauth2SetCredentials: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function OAuth2() {
        return { setCredentials: oauth2SetCredentials };
      }),
    },
    drive: vi.fn(() => ({
      files: { list: filesList, create: filesCreate },
    })),
  },
}));

import { uploadToDrive, testUpload } from "./upload.service.js";

const fakeStream = { pipe: () => {} };

beforeEach(() => {
  filesList.mockReset();
  filesCreate.mockReset();
});

describe("uploadToDrive", () => {
  it("reuses an existing folder instead of creating a duplicate", async () => {
    filesList.mockResolvedValueOnce({
      data: { files: [{ id: "existing-folder-id", name: "reports" }] },
    });
    filesCreate.mockResolvedValueOnce({ data: { id: "file-id", name: "hello.txt" } });

    const result = await uploadToDrive(fakeStream, "hello.txt", "/reports");

    expect(filesList).toHaveBeenCalledTimes(1);
    expect(filesCreate).toHaveBeenCalledTimes(1); // only the file, no folder creation
    const createArgs = filesCreate.mock.calls[0][0];
    expect(createArgs.resource.parents).toEqual(["existing-folder-id"]);
    expect(createArgs.media.body).toBe(fakeStream);
    expect(result).toEqual({ id: "file-id", name: "hello.txt" });
  });

  it("creates missing folders in the path before uploading the file", async () => {
    filesList.mockResolvedValue({ data: { files: [] } }); // no existing folder at any level
    filesCreate
      .mockResolvedValueOnce({ data: { id: "folder-a-id" } })
      .mockResolvedValueOnce({ data: { id: "folder-b-id" } })
      .mockResolvedValueOnce({ data: { id: "file-id", name: "hello.txt" } });

    const result = await uploadToDrive(fakeStream, "hello.txt", "/a/b");

    expect(filesList).toHaveBeenCalledTimes(2); // one lookup per path segment
    expect(filesCreate).toHaveBeenCalledTimes(3); // folder "a" + folder "b" + the file
    expect(result).toEqual({ id: "file-id", name: "hello.txt" });
  });
});

describe("testUpload", () => {
  it("formats the returned path relative to the drive root", async () => {
    filesList.mockResolvedValueOnce({ data: { files: [{ id: "folder-id" }] } });
    filesCreate.mockResolvedValueOnce({ data: { id: "file-id", name: "hello.txt" } });

    const result = await testUpload(fakeStream, "hello.txt", "/reports");

    expect(result).toEqual([{ id: "file-id", path: "reports/hello.txt" }]);
  });
});
