import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";
import type { ChatMessage, ChatOption } from "@/lib/chat/types";

const HISTORY_LIMIT = 200;

export async function GET(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId." }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("id, sender, text, options, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    if (error) {
      return internalErrorResponse(error, "Chat history operation failed.");
    }

    const messages: ChatMessage[] = (data ?? []).map((row) => {
      let options: ChatOption[] = [];
      const raw = row.options;
      if (typeof raw === "string") {
        try {
          options = JSON.parse(raw) as ChatOption[];
        } catch {
          options = [];
        }
      } else if (Array.isArray(raw)) {
        options = raw as ChatOption[];
      }

      return {
        id: row.id,
        sender: row.sender,
        text: row.text,
        options,
        createdAt: row.created_at,
        timestamp: new Date(row.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    });

    return Response.json({ messages });
  } catch (error) {
    return internalErrorResponse(error, "Failed to load chat history.");
  }
}

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { sender?: string; text?: string; options?: ChatOption[]; sessionId?: string }
    | null;

  const sender = body?.sender;
  const text = body?.text?.trim();
  const optionsPayload = body?.options ?? [];
  const sessionId = body?.sessionId ?? "default";

  if (sender !== "user" && sender !== "ai") {
    return Response.json({ error: "Invalid sender." }, { status: 400 });
  }
  if (!text) {
    return Response.json({ error: "Missing message text." }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .insert({
        sender,
        text,
        options: JSON.stringify(optionsPayload),
        session_id: sessionId,
      })
      .select("id, sender, text, options, created_at")
      .single();

    if (error) {
      return internalErrorResponse(error, "Chat history operation failed.");
    }

    const row = data as { id: string; sender: string; text: string; options: unknown; created_at: string };
    let options: ChatOption[] = [];
    const raw = row.options;
    if (typeof raw === "string") {
      try {
        options = JSON.parse(raw) as ChatOption[];
      } catch {
        options = [];
      }
    } else if (Array.isArray(raw)) {
      options = raw as ChatOption[];
    }

    const message: ChatMessage = {
      id: row.id,
      sender: row.sender as "user" | "ai",
      text: row.text,
      options,
      createdAt: row.created_at,
      timestamp: new Date(row.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    return Response.json({ message });
  } catch (error) {
    return internalErrorResponse(error, "Failed to save message.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  try {
    const supabase = getServiceSupabase();
    let query = supabase.from("ai_chat_messages").delete();

    // Clear only the given session, or all history when no session is supplied.
    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { error } = await query;
    if (error) {
      return internalErrorResponse(error, "Chat history operation failed.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return internalErrorResponse(error, "Failed to clear history.");
  }
}