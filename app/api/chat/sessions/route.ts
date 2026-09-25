import { getServiceSupabase } from "@/lib/supabase/server";
import { requireChatAuth } from "@/lib/chat/auth";

export interface ChatSessionSummary {
  session_id: string;
  last_text: string;
  msg_count: number;
  created_at: string | null;
}

export async function GET(request: Request) {
  try {
    await requireChatAuth(request);
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("session_id, sender, text, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const sessionsMap = new Map<
      string,
      { session_id: string; last_text: string; msg_count: number; created_at: string | null; has_user_msg: boolean }
    >();

    for (const row of (data ?? []) as Array<{
      session_id: string;
      sender: string;
      text: string;
      created_at: string;
    }>) {
      const sId = row.session_id || "default";
      const isUser = row.sender === "user";

      if (!sessionsMap.has(sId)) {
        sessionsMap.set(sId, {
          session_id: sId,
          last_text: row.text,
          created_at: row.created_at,
          msg_count: 1,
          has_user_msg: isUser,
        });
      } else {
        const session = sessionsMap.get(sId)!;
        session.msg_count += 1;
        if (isUser) session.has_user_msg = true;
      }
    }

    // Skip empty sessions where the user never sent anything.
    const sessions: ChatSessionSummary[] = Array.from(sessionsMap.values())
      .filter((session) => session.has_user_msg)
      .map(({ session_id, last_text, msg_count, created_at }) => ({
        session_id,
        last_text,
        msg_count,
        created_at,
      }));

    return Response.json({ sessions });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load chat sessions." },
      { status: 500 },
    );
  }
}