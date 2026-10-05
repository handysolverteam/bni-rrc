import { describe, expect, it } from "vitest";
import { isSafeInternalPath, isSafeSsoReturnUrl } from "../lib/sso-guard";

const SELF = "https://bni-rrc.vercel.app";
const PARTNERS = ["https://www.handychapter.com", "https://handychapter.vercel.app"];

describe("isSafeSsoReturnUrl", () => {
  it("allows the app's own origin", () => {
    expect(isSafeSsoReturnUrl("https://bni-rrc.vercel.app/?sso=callback&ssoCode=x", SELF, PARTNERS)).toBe(true);
  });

  it("allows an exact trusted partner origin", () => {
    expect(isSafeSsoReturnUrl("https://www.handychapter.com/?sso=callback", SELF, PARTNERS)).toBe(true);
  });

  it("allows a partner that matches only one configured entry", () => {
    expect(isSafeSsoReturnUrl("https://handychapter.vercel.app/", SELF, PARTNERS)).toBe(true);
  });

  it("rejects an unknown origin", () => {
    expect(isSafeSsoReturnUrl("https://evil.com/?sso=callback", SELF, PARTNERS)).toBe(false);
  });

  it("rejects a lookalike domain that only shares a suffix with a partner", () => {
    expect(isSafeSsoReturnUrl("https://www.handychapter.com.evil.com/?x=1", SELF, PARTNERS)).toBe(false);
  });

  it("rejects a partner subdomain as if it were the bare partner", () => {
    expect(isSafeSsoReturnUrl("https://handychapter.com/?x=1", SELF, PARTNERS)).toBe(false);
  });

  it("rejects a partner with an unexpected port", () => {
    expect(isSafeSsoReturnUrl("https://www.handychapter.com:8443/?x=1", SELF, PARTNERS)).toBe(false);
  });

  it("rejects embedded userinfo", () => {
    expect(isSafeSsoReturnUrl("https://www.handychapter.com@evil.com/?x=1", SELF, PARTNERS)).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isSafeSsoReturnUrl("javascript:alert(1)", SELF, PARTNERS)).toBe(false);
    expect(isSafeSsoReturnUrl("file:///etc/passwd", SELF, PARTNERS)).toBe(false);
  });

  it("rejects garbage and non-URLs", () => {
    expect(isSafeSsoReturnUrl("", SELF, PARTNERS)).toBe(false);
    expect(isSafeSsoReturnUrl("not a url", SELF, PARTNERS)).toBe(false);
    expect(isSafeSsoReturnUrl("//evil.com/?x=1", SELF, PARTNERS)).toBe(false);
  });

  it("rejects when the self origin itself is unparseable", () => {
    expect(isSafeSsoReturnUrl("https://evil.com/?x=1", "not-an-origin", PARTNERS)).toBe(false);
  });

  it("ignores unparseable partner config entries", () => {
    const dirtyPartners = [...PARTNERS, "%%%bad%%%", "ftp://x"];
    expect(isSafeSsoReturnUrl("https://www.handychapter.com/?sso=callback", SELF, dirtyPartners)).toBe(true);
  });
});

describe("isSafeInternalPath", () => {
  it("accepts internal absolute paths", () => {
    expect(isSafeInternalPath("/")).toBe(true);
    expect(isSafeInternalPath("/chat")).toBe(true);
    expect(isSafeInternalPath("/tasks/5")).toBe(true);
    expect(isSafeInternalPath("/import?x=1&y=2")).toBe(true);
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
    expect(isSafeInternalPath("http://evil.com/path")).toBe(false);
  });

  it("rejects relative, backslash, and control characters", () => {
    expect(isSafeInternalPath("chat")).toBe(false);
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(isSafeInternalPath("/\u0000")).toBe(false);
  });
});