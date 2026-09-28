"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { firebaseAuth } from "@/lib/firebase/client";
import { authedFetch } from "@/lib/auth-token";
import { getWhatsAppUrl } from "@/lib/chat/format";
import { withLocalTimestamps } from "@/lib/chat/timestamps";
import type { ChatMessage, ChatOption } from "@/lib/chat/types";

function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/\*(.*?)\*/g);
    const rendered = parts.map((part, partIdx) =>
      partIdx % 2 === 1 ? (
        <strong key={partIdx} className="font-bold text-[var(--accent)]">
          {part}
        </strong>
      ) : (
        part
      ),
    );
    return (
      <span key={lineIdx}>
        {rendered}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

const fmtTime = (date = new Date()) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const authFetch = authedFetch;

export default function ChatTab() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = sessionStorage.getItem("bniAiChatSession");
    if (existing) return existing;
    const fresh = `sess_${Date.now()}`;
    sessionStorage.setItem("bniAiChatSession", fresh);
    return fresh;
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [welcomeText, setWelcomeText] = useState<string>("");
  const [customInput, setCustomInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState<Array<{ session_id: string; last_text: string; msg_count: number; created_at: string | null }>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const userDisplayName = useMemo(() => {
    const candidate = user?.displayName || user?.email?.split("@")[0];
    if (!candidate) return "Member";
    return candidate;
  }, [user]);

  const welcomeMessage = useMemo(() => {
    const firstName = userDisplayName.split(" ")[0];
    return `👋 *Welcome to the BNI Renewal CRM Assistant, ${firstName}!*\n\nI analyze the renewal pipeline (Critical Deadline, Payment Pending, Documents Pending), member traffic-light zones, TYFCB business, committee & past roles. Ask me anything below:`;
  }, [userDisplayName]);

  useEffect(() => {
    setWelcomeText(welcomeMessage);
    if (messages.length === 0) {
      setMessages([
        {
          id: `welcome_${Date.now()}`,
          sender: "ai",
          text: welcomeMessage,
          timestamp: fmtTime(),
        },
      ]);
    }
  }, [welcomeMessage, messages.length]);

  const latestAiMsgId = useMemo(() => {
    const aiMsgs = messages.filter((m) => m.sender === "ai");
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1].id : null;
  }, [messages]);

  const loadHistory = useCallback(
    async (targetSessionId: string) => {
      try {
        const response = await authFetch(
          `/api/chat/history?sessionId=${encodeURIComponent(targetSessionId)}`,
        );
        if (!response.ok) return;
        const { messages: serverMessages } = (await response.json()) as {
          messages: ChatMessage[];
        };
        if (serverMessages && serverMessages.length > 0) {
          setMessages(withLocalTimestamps(serverMessages));
        } else {
          setMessages([
            {
              id: `welcome_${Date.now()}`,
              sender: "ai",
              text: welcomeText,
              timestamp: fmtTime(),
            },
          ]);
        }
      } catch {
        // Keep whatever is on screen.
      }
    },
    [welcomeText],
  );

  useEffect(() => {
    loadHistory(sessionId);
  }, [sessionId, loadHistory]);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  };

  const autoScroll = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    autoScroll();
  }, [messages, isTyping, autoScroll]);

  const saveMessage = async (sender: "user" | "ai", text: string, options: ChatOption[] = []) => {
    try {
      const response = await authFetch("/api/chat/history", {
        method: "POST",
        body: JSON.stringify({ sender, text, options, sessionId }),
      });
      if (!response.ok) {
        // Best-effort, but never silent: a failing save means history won't survive refresh.
        console.warn(`Chat history save failed (${response.status}). Migration 016 may not be applied.`);
      }
    } catch (error) {
      // Persistence is best-effort; never block the UI on it.
      console.warn("Chat history save failed:", error instanceof Error ? error.message : error);
    }
  };

  const handleStartNewChat = () => {
    const fresh = `sess_${Date.now()}`;
    sessionStorage.setItem("bniAiChatSession", fresh);
    setSessionId(fresh);
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: "ai",
        text: `✨ *New Conversation Started*\n\n${welcomeMessage}`,
        timestamp: fmtTime(),
      },
    ]);
    showToast("Started a new conversation");
  };

  const handleShareConversation = () => {
    if (messages.length === 0) {
      showToast("No conversation to share");
      return;
    }
    let shareText = `💬 *BNI Renewal CRM Chat Log*\n\n`;
    messages.forEach((m) => {
      const role = m.sender === "user" ? "👤 *User*" : "🤖 *Chapter AI*";
      shareText += `${role} (${m.timestamp}):\n${m.text.trim()}\n\n`;
    });
    window.open(getWhatsAppUrl(shareText.trim()), "_blank");
  };

  const handleOpenHistory = async () => {
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    try {
      const response = await authFetch("/api/chat/sessions");
      if (!response.ok) return;
      const { sessions } = (await response.json()) as {
        sessions: Array<{ session_id: string; last_text: string; msg_count: number; created_at: string | null }>;
      };
      setPastSessions(sessions ?? []);
    } catch {
      setPastSessions([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectSession = (targetSessionId: string) => {
    sessionStorage.setItem("bniAiChatSession", targetSessionId);
    setSessionId(targetSessionId);
    setIsHistoryOpen(false);
    loadHistory(targetSessionId);
    showToast("Loaded conversation");
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeletingHistory(true);
    try {
      await authFetch("/api/chat/history", { method: "DELETE" });
      const fresh = `sess_${Date.now()}`;
      sessionStorage.setItem("bniAiChatSession", fresh);
      setSessionId(fresh);
      setMessages([
        {
          id: `welcome_${Date.now()}`,
          sender: "ai",
          text: welcomeText,
          timestamp: fmtTime(),
        },
      ]);
      setPastSessions([]);
      showToast("All chat history deleted");
    } catch {
      showToast("Failed to delete history");
    } finally {
      setIsDeletingHistory(false);
      setIsDeleteConfirmOpen(false);
      setIsHistoryOpen(false);
    }
  };

  const requestGeneration = async (input: {
    message?: string;
    action?: string;
    payload?: Record<string, unknown>;
    regenerateTarget?: string;
  }) => {
    const payload: Record<string, unknown> = {
      ...input,
      userName: firebaseAuth.currentUser?.displayName || userDisplayName,
      userCategory: "Chapter Member",
    };
    if (!input.action) {
      payload.history = messages
        .filter((m) => !m.id.startsWith("welcome_"))
        .slice(-12)
        .map(({ id, sender, text }) => ({ id, sender, text }));
    }

    const response = await authFetch("/api/chat/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "AI request failed");
    }

    return (await response.json()) as { text: string; options?: ChatOption[]; source?: string };
  };

  const handleSendCustomMessage = async () => {
    const text = customInput.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text,
      timestamp: fmtTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setCustomInput("");
    setIsTyping(true);
    await saveMessage("user", text);

    try {
      const result = await requestGeneration({ message: text });
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: result.text,
        options: result.options ?? [],
        timestamp: fmtTime(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      await saveMessage("ai", result.text, result.options ?? []);
    } catch (error) {
      const errMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        sender: "ai",
        text: `⚠️ *I ran into a problem answering that.*\n\n${error instanceof Error ? error.message : "Please try again."}`,
        timestamp: fmtTime(),
      };
      setMessages((prev) => [...prev, errMsg]);
      await saveMessage("ai", errMsg.text, errMsg.options);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRegenerate = async (msgToRegenerate: ChatMessage) => {
    if (msgToRegenerate.id !== latestAiMsgId || isTyping || regeneratingId) return;

    const msgIndex = messages.findIndex((m) => m.id === msgToRegenerate.id);
    let promptText = "";
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].sender === "user") {
        promptText = messages[i].text;
        break;
      }
    }
    if (!promptText) promptText = "give me the chapter executive overview";

    setRegeneratingId(msgToRegenerate.id);
    setIsTyping(true);
    try {
      const result = await requestGeneration({
        message: promptText,
        regenerateTarget: msgToRegenerate.text,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgToRegenerate.id ? { ...m, text: result.text } : m)),
      );
      await saveMessage("ai", result.text, msgToRegenerate.options ?? []);
      showToast("Response regenerated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to regenerate");
    } finally {
      setIsTyping(false);
      setRegeneratingId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text.trim()).then(() => {
      setCopiedId(id);
      showToast("Copied message text");
      window.setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleShareWhatsApp = (text: string) => {
    window.open(getWhatsAppUrl(text.trim()), "_blank");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendCustomMessage();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] text-[var(--accent)]">
            <BotIcon />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-normal">Chapter AI</h1>
            <p className="text-xs text-[var(--muted)]">Renewal & membership assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareConversation}
            className="focus-ring flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#eef1ea]"
            title="Share conversation via WhatsApp"
          >
            <ShareIcon />
            <span className="hidden sm:inline">Share Log</span>
          </button>
          <button
            onClick={handleStartNewChat}
            className="focus-ring flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#eef1ea]"
            title="Start a new conversation"
          >
            <PlusIcon />
            <span className="hidden sm:inline">New Chat</span>
          </button>
          <button
            onClick={() => void handleOpenHistory()}
            className="focus-ring flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#eef1ea]"
            title="View past conversations"
          >
            <HistoryIcon />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-1 py-3">
        <div className="mx-auto max-w-3xl space-y-4 pb-24 md:pb-4">
          {messages.map((msg) => {
            const isMenuMessage =
              msg.text.includes("Main Menu") || msg.text.includes("Welcome to");

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.sender === "user" ? (
                  user?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt={userDisplayName}
                      className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-[var(--line)] object-cover"
                    />
                  ) : (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-contrast)]">
                      {userDisplayName.charAt(0).toUpperCase()}
                    </div>
                  )
                ) : (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--accent)]">
                    <BotIcon />
                  </div>
                )}

                <div
                  className={`max-w-[92%] space-y-2.5 rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${
                    msg.sender === "user"
                      ? "rounded-tr-none bg-[#eef1ea]"
                      : "rounded-tl-none border border-[var(--line)] bg-white"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{renderFormattedText(msg.text)}</div>

                  <div className="text-right font-mono text-[10px] text-[var(--muted)]">
                    {msg.timestamp}
                  </div>

                  {msg.sender === "ai" && !isMenuMessage && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5">
                      <button
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="focus-ring flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[var(--muted)] transition-colors hover:bg-[#f0f2ec]"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <CheckIcon /> Copied
                          </>
                        ) : (
                          <>
                            <CopyIcon /> Copy
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleShareWhatsApp(msg.text)}
                        className="focus-ring flex min-h-8 items-center gap-1 rounded-lg bg-[var(--accent)]/10 px-2 text-[11px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/15"
                      >
                        <ShareIcon /> WhatsApp
                      </button>

                      {msg.id === latestAiMsgId && (
                        <button
                          onClick={() => void handleRegenerate(msg)}
                          disabled={regeneratingId === msg.id}
                          className="focus-ring flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:bg-[#f0f2ec] disabled:opacity-50"
                        >
                          <RefreshIcon spinning={regeneratingId === msg.id} /> Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 pl-2 text-xs italic text-[var(--muted)]">
              <span className="inline-flex">
                <span className="mx-0.5 h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
                <span className="mx-0.5 h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:120ms]" />
                <span className="mx-0.5 h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:240ms]" />
              </span>
              Chapter AI is analyzing your chapter data...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="border-t border-[var(--line)] bg-white px-1 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-[var(--line)] bg-[#fbfbf8] p-1.5">
          <input
            type="text"
            placeholder="Ask about renewals, members, zones, TYFCB..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            className="min-h-11 flex-1 bg-transparent px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void handleSendCustomMessage()}
            disabled={!customInput.trim() || isTyping}
            className="focus-ring flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">Send</span>
            <SendIcon />
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div>
                <h2 className="font-semibold">Chat History</h2>
                <p className="text-xs text-[var(--muted)]">
                  {pastSessions.length} past conversation(s)
                </p>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="focus-ring flex min-h-9 items-center rounded-md px-3 text-sm text-[var(--muted)] hover:bg-[#f0f2ec]"
              >
                Close
              </button>
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
              {isLoadingHistory ? (
                <p className="py-6 text-center text-sm text-[var(--muted)]">Loading conversations...</p>
              ) : pastSessions.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--muted)]">
                  No past conversations yet. Start chatting to save them.
                </p>
              ) : (
                pastSessions.map((session) => {
                  const isCurrent = session.session_id === sessionId;
                  const dateText = session.created_at
                    ? new Date(session.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "unknown date";

                  return (
                    <button
                      key={session.session_id}
                      onClick={() => handleSelectSession(session.session_id)}
                      className={`focus-ring flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                        isCurrent
                          ? "border-[var(--accent)] bg-[var(--accent)]/5"
                          : "border-[var(--line)] bg-[#fbfbf8] hover:bg-[#eef1ea]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {session.last_text || "Conversation"}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {dateText} • {session.msg_count} message(s)
                          {isCurrent ? " • Active" : ""}
                        </p>
                      </div>
                      <ArrowIcon />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3">
              {pastSessions.length > 0 ? (
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="focus-ring flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-[var(--danger)] hover:bg-[#f8edeb]"
                >
                  <TrashIcon /> Delete All History
                </button>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Delete all chat history?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This permanently erases all saved conversations. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-4 text-sm font-medium hover:bg-[#f0f2ec]"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDeleteAll()}
                disabled={isDeletingHistory}
                className="focus-ring flex min-h-11 items-center gap-2 rounded-md bg-[var(--danger)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {isDeletingHistory ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}