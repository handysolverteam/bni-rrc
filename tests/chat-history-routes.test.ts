import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiAuth } from "@/lib/require-api-auth";
import { getServiceSupabase } from "@/lib/supabase/server";
import {
  DELETE as historyDELETE,
  GET as historyGET,
  POST as historyPOST,
} from "@/app/api/chat/history/route";
import { GET as sessionsGET } from "@/app/api/chat/sessions/route";

vi.mock("@/lib/require-api-auth", () => ({ requireApiAuth: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: vi.fn() }));

const mockedAuth = vi.mocked(requireApiAuth);
const mockedSupabase = vi.mocked(getServiceSupabase);

interface Call {
  method: string;
  args: unknown[];
}

/** Chainable supabase stub: methods record and return self; awaiting resolves `result`. */
function chain(result: { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const stub: Record<string, unknown> = {};
  for (const m of ["from", "select", "insert", "delete", "eq", "order", "limit", "single"]) {
    stub[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return stub;
    };
  }
  stub.then = (resolve: (v: unknown) => void) => resolve(result);
  return { stub, calls };
}

function eqArgs(calls: Call[]): unknown[][] {
  return calls.filter((c) => c.method === "eq").map((c) => c.args);
}

const ROW = {
  id: "row-1",
  sender: "user",
  text: "hello",
  options: "[]",
  created_at: "2026-09-01T10:00:00Z",
  session_id: "s1",
};

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/chat/history", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ uid: "user-1", email: null });
});

describe("chat history routes are scoped to the caller", () => {
  it("GET history filters by user_id and session_id", async () => {
    const { stub, calls } = chain({ data: [ROW], error: null });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await historyGET(get("http://localhost/api/chat/history?sessionId=s1"));
    expect(res.status).toBe(200);
    expect(eqArgs(calls)).toContainEqual(["user_id", "user-1"]);
    expect(eqArgs(calls)).toContainEqual(["session_id", "s1"]);
    const body = (await res.json()) as { messages: Array<{ text: string }> };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.text).toBe("hello");
  });

  it("GET history tolerates corrupt stored options", async () => {
    const { stub } = chain({
      data: [{ ...ROW, options: "{not-json" }],
      error: null,
    });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await historyGET(get("http://localhost/api/chat/history?sessionId=s1"));
    const body = (await res.json()) as { messages: Array<{ options: unknown[] }> };
    expect(body.messages[0]?.options).toEqual([]);
  });

  it("GET history requires a sessionId", async () => {
    const res = await historyGET(get("http://localhost/api/chat/history"));
    expect(res.status).toBe(400);
  });

  it("POST history stamps the caller's user_id", async () => {
    const { stub, calls } = chain({ data: { ...ROW, options: "[]" }, error: null });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await historyPOST(
      post({ sender: "user", text: "hi", options: [], sessionId: "s1" }),
    );
    expect(res.status).toBe(200);
    const insert = calls.find((c) => c.method === "insert");
    expect(insert?.args[0]).toMatchObject({ sender: "user", text: "hi", user_id: "user-1" });
  });

  it("POST history rejects bad senders, empty and oversized text", async () => {
    const { stub } = chain({ data: null, error: null });
    mockedSupabase.mockReturnValue(stub as never);
    expect(
      (await historyPOST(post({ sender: "bot", text: "hi" }))).status,
    ).toBe(400);
    expect((await historyPOST(post({ sender: "user", text: "   " }))).status).toBe(400);
    expect(
      (await historyPOST(post({ sender: "user", text: "x".repeat(100_001) }))).status,
    ).toBe(400);
    const { stub: okStub } = chain({ data: { ...ROW, options: "[]" }, error: null });
    mockedSupabase.mockReturnValue(okStub as never);
    expect(
      (await historyPOST(post({ sender: "ai", text: "y".repeat(5000) }))).status,
    ).toBe(200);
  });

  it("DELETE history always scopes to the caller", async () => {
    const scoped = chain({ error: null });
    mockedSupabase.mockReturnValue(scoped.stub as never);
    const withSession = await historyDELETE(
      new Request("http://localhost/api/chat/history?sessionId=s1", { method: "DELETE" }),
    );
    expect(withSession.status).toBe(200);
    expect(eqArgs(scoped.calls)).toContainEqual(["user_id", "user-1"]);
    expect(eqArgs(scoped.calls)).toContainEqual(["session_id", "s1"]);

    const cleared = chain({ error: null });
    mockedSupabase.mockReturnValue(cleared.stub as never);
    const clearAll = await historyDELETE(
      new Request("http://localhost/api/chat/history", { method: "DELETE" }),
    );
    expect(clearAll.status).toBe(200);
    expect(eqArgs(cleared.calls)).toContainEqual(["user_id", "user-1"]);
    expect(eqArgs(cleared.calls)).not.toContainEqual(["session_id", "s1"]);
  });

  it("GET sessions lists only the caller's sessions", async () => {
    const { stub, calls } = chain({
      data: [
        { session_id: "s1", sender: "user", text: "q", created_at: "2026-09-01T10:00:00Z" },
        { session_id: "s1", sender: "ai", text: "a", created_at: "2026-09-01T10:01:00Z" },
        { session_id: "s2", sender: "ai", text: "orphan", created_at: "2026-09-01T11:00:00Z" },
      ],
      error: null,
    });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await sessionsGET(get("http://localhost/api/chat/sessions"));
    expect(res.status).toBe(200);
    expect(eqArgs(calls)).toContainEqual(["user_id", "user-1"]);
    const body = (await res.json()) as {
      sessions: Array<{ session_id: string; msg_count: number }>;
    };
    // s2 has no user message and is skipped.
    expect(body.sessions.map((s) => s.session_id)).toEqual(["s1"]);
    expect(body.sessions[0]?.msg_count).toBe(2);
  });

  it("rejects unauthenticated callers on every chat route", async () => {
    mockedAuth.mockRejectedValue(new Error("Missing bearer token."));
    expect((await historyGET(get("http://localhost/api/chat/history?sessionId=s1"))).status).toBe(
      401,
    );
    expect((await historyPOST(post({ sender: "user", text: "hi" }))).status).toBe(401);
    expect(
      (
        await historyDELETE(
          new Request("http://localhost/api/chat/history", { method: "DELETE" }),
        )
      ).status,
    ).toBe(401);
    expect((await sessionsGET(get("http://localhost/api/chat/sessions"))).status).toBe(401);
  });
});
