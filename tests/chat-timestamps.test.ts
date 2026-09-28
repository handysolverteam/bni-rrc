import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatChatTime, withLocalTimestamps } from "../lib/chat/timestamps";
import type { ChatMessage } from "../lib/chat/types";

const PREV_TZ = process.env.TZ;

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    sender: "ai",
    text: "hello",
    timestamp: "SERVER-TIME",
    createdAt: "2026-09-28T08:25:00.000Z",
    ...overrides,
  };
}

describe("chat timestamps", () => {
  beforeEach(() => {
    process.env.TZ = "Asia/Kolkata";
  });

  afterEach(() => {
    if (PREV_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = PREV_TZ;
  });

  it("formats a UTC instant in the viewer's timezone", () => {
    // 08:25 UTC == 13:55 IST.
    expect(formatChatTime(new Date("2026-09-28T08:25:00.000Z"))).toMatch(/1:55/i);
  });

  it("re-stamps server-loaded messages to local time", () => {
    const [fixed] = withLocalTimestamps([msg({})]);
    expect(fixed?.timestamp).toMatch(/1:55/i);
    expect(fixed?.timestamp).not.toBe("SERVER-TIME");
  });

  it("leaves messages without a usable timestamp alone", () => {
    const [noCreated] = withLocalTimestamps([msg({ createdAt: undefined })]);
    expect(noCreated?.timestamp).toBe("SERVER-TIME");
    const [garbage] = withLocalTimestamps([msg({ createdAt: "not-a-date" })]);
    expect(garbage?.timestamp).toBe("SERVER-TIME");
    expect(withLocalTimestamps([])).toEqual([]);
  });
});
