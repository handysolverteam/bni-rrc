import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES,
  contentLengthExceedsLimit,
  filesExceedLimit,
} from "../lib/import-guard";

function fakeFile(size: number): File {
  return new File([new Uint8Array(size)], "report.xls");
}

describe("import size guard", () => {
  it("allows uploads within the cap", () => {
    expect(filesExceedLimit([fakeFile(1024 * 1024)])).toBe(false);
    expect(filesExceedLimit([fakeFile(7 * 1024 * 1024), fakeFile(7 * 1024 * 1024)])).toBe(false);
  });

  it("rejects combined sizes over the cap", () => {
    expect(filesExceedLimit([fakeFile(MAX_IMPORT_BYTES + 1)])).toBe(true);
    expect(filesExceedLimit([fakeFile(8 * 1024 * 1024), fakeFile(8 * 1024 * 1024)])).toBe(true);
  });

  it("allows a single file exactly at the cap boundary", () => {
    expect(filesExceedLimit([fakeFile(MAX_IMPORT_BYTES)])).toBe(false);
  });

  it("checks the Content-Length header cheaply", () => {
    const over = new Request("http://x/import", {
      method: "POST",
      headers: { "content-length": String(MAX_IMPORT_BYTES + 1) },
    });
    const under = new Request("http://x/import", {
      method: "POST",
      headers: { "content-length": String(1024) },
    });
    const absent = new Request("http://x/import", { method: "POST" });
    expect(contentLengthExceedsLimit(over)).toBe(true);
    expect(contentLengthExceedsLimit(under)).toBe(false);
    expect(contentLengthExceedsLimit(absent)).toBe(false);
  });

  it("ignores a malformed Content-Length header", () => {
    const request = new Request("http://x/import", {
      method: "POST",
      headers: { "content-length": "not-a-number" },
    });
    expect(contentLengthExceedsLimit(request)).toBe(false);
  });
});