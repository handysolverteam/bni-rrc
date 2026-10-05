import { getChatSnapshot } from "@/lib/chat/snapshot";
import { askGemini } from "@/lib/chat/prompt";
import { analyzeLocalChapterQuery } from "@/lib/chat/localAiEngine";
import { resolveOptionAction } from "@/lib/chat/actions";
import { requireApiAuth } from "@/lib/require-api-auth";
import { chatRateLimiter } from "@/lib/rate-limit";
import { internalErrorResponse } from "@/lib/api-errors";
import type { ChatMessage, ChatOption } from "@/lib/chat/types";

/** Per-request message cap (DoS + LLM cost guard). */
const MAX_CHAT_MESSAGE_LENGTH = 2000;

/**
 * Chat generate endpoint. Builds the privacy-safe snapshot server-side, resolves
 * quick-option actions structurally, otherwise asks Gemini (server key) and falls
 * back to the local rule engine. Never returns raw member data -- only generated
 * reply text + follow-up options.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireApiAuth(request);
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (chatRateLimiter.isRateLimited(`chat:${user.uid}`)) {
    return Response.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        message?: string;
        action?: string;
        payload?: Record<string, unknown>;
        history?: ChatMessage[];
        userName?: string;
        userCategory?: string;
        regenerateTarget?: string;
      }
    | null;

  if (!body) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const snapshot = await getChatSnapshot();

    // Quick-option action: fully deterministic reply computed from the snapshot.
    if (body.action) {
      const option: ChatOption = {
        id: `act_${Date.now()}`,
        label: body.message || "",
        action: body.action,
        payload: body.payload,
      };
      const reply = resolveOptionAction(option, snapshot);
      return Response.json({ text: reply.text, options: reply.options, source: "action" });
    }

    const message = body.message?.trim();
    if (!message) {
      return Response.json({ error: "Missing message." }, { status: 400 });
    }
    if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
      return Response.json({ error: "Message is too long." }, { status: 400 });
    }

    const userName = body.userName?.trim() || "Member";
    const userCategory = body.userCategory?.trim() || "Chapter Member";

    // Regeneration: hand the previous (rejected) reply back with a self-correction directive.
    const regenerationDirective = body.regenerateTarget
      ? `${message}

[SYSTEM REGENERATION DIRECTIVE - CRITICAL SELF-CORRECTION REQUIRED]:
The user requested a REGENERATION of your previous response because it was incomplete or generic.

PREVIOUS REJECTED RESPONSE:
"${body.regenerateTarget}"

REGENERATION INSTRUCTIONS:
1. First figure out WHY the previous response was unsatisfactory.
2. Produce a MUCH MORE COMPLETE, DETAILED answer using only the snapshot above.
3. Name every relevant member with scores/zones/renewal statuses; do not truncate lists.
4. Conclude with a direct, specific follow-up action.`
      : null;

    let text: string | null = null;
    let source = "gemini";

    if (process.env.GEMINI_API_KEY) {
      text = await askGemini({
        prompt: message,
        snapshot,
        userName,
        userCategory,
        history: body.history ?? [],
        regenerationDirective: regenerationDirective ?? undefined,
        temperature: regenerationDirective ? 0.8 : 0.2,
      });
    }

    if (!text || !text.trim()) {
      text = analyzeLocalChapterQuery(message, snapshot, userName);
      source = "local";
      // The local engine is deterministic: without this note a Regenerate
      // click would silently return the identical reply.
      if (
        body.regenerateTarget &&
        text.trim() === body.regenerateTarget.trim()
      ) {
        text +=
          "\n\n🔁 *Regenerated on request — the offline engine gives the same complete answer for the same question. Rephrase it, name a member, or pick a zone or stage for a different angle.*";
      }
    }

    return Response.json({
      text: text.replace(/\*\*/g, "*").trim(),
      options: [
        { id: "opt_main", label: "🏠 Main Menu", action: "MAIN_MENU" },
      ],
      source,
    });
  } catch (error) {
    return internalErrorResponse(error, "Failed to generate a reply.");
  }
}