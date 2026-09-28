import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../lib/rate-limit";

describe("rate limiter", () => {
  it("allows requests up to the limit within the window", () => {
    const limiter = createRateLimiter(3, 60_000);
    expect(limiter.isRateLimited("a")).toBe(false);
    expect(limiter.isRateLimited("a")).toBe(false);
    expect(limiter.isRateLimited("a")).toBe(false);
    expect(limiter.isRateLimited("a")).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter.isRateLimited("x")).toBe(false);
    expect(limiter.isRateLimited("y")).toBe(false);
    expect(limiter.isRateLimited("x")).toBe(true);
    expect(limiter.isRateLimited("y")).toBe(true);
  });

  it("lets the window slide: old timestamps expire", () => {
    const limiter = createRateLimiter(2, 50);
    expect(limiter.isRateLimited("a")).toBe(false);
    expect(limiter.isRateLimited("a")).toBe(false);
    expect(limiter.isRateLimited("a")).toBe(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(limiter.isRateLimited("a")).toBe(false);
        resolve(void 0);
      }, 60);
    });
  });
});