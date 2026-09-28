import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiAuth } from "@/lib/require-api-auth";
import { getChatSnapshot } from "@/lib/chat/snapshot";
import { askGemini } from "@/lib/chat/prompt";
import { POST } from "@/app/api/chat/generate/route";
import type { ChatSnapshot } from "@/lib/chat/types";

vi.mock("@/lib/require-api-auth", () => ({ requireApiAuth: vi.fn() }));
vi.mock("@/lib/chat/snapshot", () => ({ getChatSnapshot: vi.fn() }));
vi.mock("@/lib/chat/prompt", () => ({ askGemini: vi.fn() }));

const mockedAuth = vi.mocked(requireApiAuth);
const mockedSnapshot = vi.mocked(getChatSnapshot);
const mockedGemini = vi.mocked(askGemini);

const SNAPSHOT = {
  chapterName: "NOVA BNI",
  summary: {
    memberCount: 0,
    committeeCount: 0,
    activeCycles: 0,
    renewedCount: 0,
    droppedCount: 0,
    averageScore: null,
    greenCount: 0,
    amberCount: 0,
    redCount: 0,
    greyCount: 0,
    totalTyfcb: 0,
  },
  members: [],
} as unknown as ChatSnapshot;

function post(body: unknown): Request {
  return new Request("http://localhost/api/chat/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ uid: "gen-user", email: null });
  mockedSnapshot.mockResolvedValue(SNAPSHOT);
  mockedGemini.mockResolvedValue(null);
});

describe("chat generate route wiring", () => {
  it("rejects unauthenticated callers", async () => {
    mockedAuth.mockRejectedValue(new Error("Missing bearer token."));
    expect((await POST(post({ message: "hi" }))).status).toBe(401);
  });

  it("rejects missing and oversized messages", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ message: "   " }))).status).toBe(400);
    expect((await POST(post({ message: "x".repeat(2001) }))).status).toBe(400);
  });

  it("resolves quick-option actions without the engine", async () => {
    const res = await POST(post({ action: "MAIN_MENU", message: "menu" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string; options: unknown[]; source: string };
    expect(body.source).toBe("action");
    expect(body.text).toContain("Main Menu");
    expect(body.options.length).toBeGreaterThan(0);
  });

  it("falls back to the local engine when Gemini has nothing", async () => {
    const res = await POST(post({ message: "what's the weather?" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string; source: string };
    expect(body.source).toBe("local");
    expect(body.text).toContain("NOVA BNI");
  });

  it("passes the signed-in name into the local engine", async () => {
    const snap = {
      ...SNAPSHOT,
      members: [
        {
          name: "Amit Gupta",
          industry: null,
          sponsor: null,
          memberSince: null,
          isCommittee: false,
          reportRole: null,
          latestScore: null,
          latestColor: null,
          latestReportMonth: null,
          trafficHistory: [],
          monthlyReferrals: null,
          monthlyReferralsReceived: null,
          monthlyReportMonth: null,
          palmsReferrals: null,
          palmsReferralsReceived: null,
          palmsOneToOne: null,
          palmsTyfcb: null,
          palmsCeu: null,
          palmsVisitors: null,
          renewalStatus: null,
          renewalDate: null,
          renewalStage: null,
          isTwoYear: false,
          openTaskCount: 0,
          lifetimeSponsors: 0,
          pastYearSponsors: 0,
          lifetimeTrainings: 0,
          pastYearTrainings: 0,
          pastRoles: [],
        },
      ],
    } as unknown as ChatSnapshot;
    mockedSnapshot.mockResolvedValue(snap);
    const res = await POST(post({ message: "my renewal status", userName: "Amit Gupta" }));
    const body = (await res.json()) as { text: string };
    expect(body.text).toContain("Member Record: Amit Gupta");
  });

  it("notes identical local regenerations instead of silently repeating", async () => {
    const first = (await (
      await POST(post({ message: "what's the weather?" }))
    ).json()) as { text: string };
    const res = await POST(post({ message: "what's the weather?", regenerateTarget: first.text }));
    const body = (await res.json()) as { text: string };
    expect(body.text).toContain(first.text.replace(/\*\*/g, "*").trim());
    expect(body.text).toContain("Regenerated on request");
  });

  it("prefers Gemini text when the model answers", async () => {
    // The route only calls the model when a server key is configured.
    const prev = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    try {
      mockedGemini.mockResolvedValue("Gemini says hi");
      const res = await POST(post({ message: "hello" }));
      const body = (await res.json()) as { text: string; source: string };
      expect(body.source).toBe("gemini");
      expect(body.text).toBe("Gemini says hi");
    } finally {
      if (prev === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prev;
    }
  });
});
