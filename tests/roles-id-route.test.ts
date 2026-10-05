import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiAuth } from "@/lib/require-api-auth";
import { getServiceSupabase } from "@/lib/supabase/server";
import { invalidateCache } from "@/lib/cache";
import { DELETE as rolesDELETE, PATCH as rolesPATCH } from "@/app/api/roles/[id]/route";

vi.mock("@/lib/require-api-auth", () => ({
  requireApiAuth: vi.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized." }, { status: 401 }),
}));
vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: vi.fn() }));
vi.mock("@/lib/cache", () => ({
  CACHE_TAGS: { renewals: "renewals", members: "members", imports: "imports" },
  invalidateCache: vi.fn(),
}));

const mockedAuth = vi.mocked(requireApiAuth);
const mockedSupabase = vi.mocked(getServiceSupabase);
const mockedInvalidate = vi.mocked(invalidateCache);

interface Call {
  method: string;
  args: unknown[];
}

function chain(result: { data?: unknown; count?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const stub: Record<string, unknown> = {};
  for (const m of ["from", "select", "update", "delete", "eq", "single"]) {
    stub[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return stub;
    };
  }
  stub.then = (resolve: (v: unknown) => void) => resolve(result);
  return { stub, calls };
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/roles/r1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/roles/r1", { method: "DELETE" });
}

const params = { params: Promise.resolve({ id: "r1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ uid: "user-1", email: null });
});

describe("roles [id] route invalidates member caches", () => {
  it("PATCH purges the members tag on success", async () => {
    const { stub } = chain({ data: { id: "r1", name: "President" }, error: null });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await rolesPATCH(patchRequest({ name: "President" }), params);
    expect(res.status).toBe(200);
    expect(mockedInvalidate).toHaveBeenCalledWith(["members"]);
  });

  it("PATCH keeps the cache on validation and not-found errors", async () => {
    const { stub } = chain({ data: null, error: null });
    mockedSupabase.mockReturnValue(stub as never);
    expect((await rolesPATCH(patchRequest({ name: "   " }), params)).status).toBe(400);
    expect(mockedInvalidate).not.toHaveBeenCalled();

    const missing = chain({ data: null, error: { code: "PGRST116" } });
    mockedSupabase.mockReturnValue(missing.stub as never);
    expect((await rolesPATCH(patchRequest({ name: "Ghost" }), params)).status).toBe(404);
    expect(mockedInvalidate).not.toHaveBeenCalled();
  });

  it("DELETE purges the members tag on success", async () => {
    const { stub } = chain({ count: 0, error: null });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await rolesDELETE(deleteRequest(), params);
    expect(res.status).toBe(200);
    expect(mockedInvalidate).toHaveBeenCalledWith(["members"]);
  });

  it("DELETE keeps the cache when the role is still in use", async () => {
    const { stub } = chain({ count: 2, error: null });
    mockedSupabase.mockReturnValue(stub as never);
    const res = await rolesDELETE(deleteRequest(), params);
    expect(res.status).toBe(409);
    expect(mockedInvalidate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    mockedAuth.mockRejectedValue(new Error("Missing bearer token."));
    expect((await rolesPATCH(patchRequest({ name: "X" }), params)).status).toBe(401);
    expect((await rolesDELETE(deleteRequest(), params)).status).toBe(401);
  });
});
