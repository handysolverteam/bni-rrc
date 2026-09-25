import { chatTrainingData, type TrainingData } from "./training-data";
import type { ChatMessage, ChatSnapshot } from "./types";
import { snapshotToPromptDataset } from "./snapshot";

/**
 * Server-only Gemini client. The API key lives in GEMINI_API_KEY (server env),
 * never in the browser bundle. Falls back across the same verified models the
 * go-green Chapter AI uses, returning null if none respond so callers can fall
 * back to the local rule engine.
 */

const ACTIVE_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function flattenDirectives(partial: Pick<TrainingData, "system_identity" | "core_directives">): string {
  const lines = [
    `NAME: ${partial.system_identity.name}`,
    `VERSION: ${partial.system_identity.version}`,
    `DESCRIPTION: ${partial.system_identity.description}`,
    "---CORE DIRECTIVES---",
  ];

  for (const key of Object.keys(partial.core_directives)) {
    lines.push(`* ${partial.core_directives[key]}`);
  }

  return lines.join("\n");
}

function buildTrainingSpec(): string {
  const renewalSpec = chatTrainingData.renewal_pipeline;
  const trafficLightSpec = chatTrainingData.traffic_light_specification;

  return [
    "---RENEWAL PIPELINE SPEC---",
    String(renewalSpec.description ?? ""),
    "Stages (in workflow order):",
    ...(Array.isArray(renewalSpec.stages) ? renewalSpec.stages : []).map((s) => `* ${s}`),
    `Tasks: ${String(renewalSpec.tasks ?? "")}`,
    "",
    "---TRAFFIC LIGHT ZONE SPEC---",
    String(trafficLightSpec.description ?? ""),
    `Green: ${String(trafficLightSpec.green ?? "")}`,
    `Amber: ${String(trafficLightSpec.amber ?? "")}`,
    `Red: ${String(trafficLightSpec.red ?? "")}`,
    `Grey: ${String(trafficLightSpec.grey ?? "")}`,
  ].join("\n");
}

function buildSystemInstruction(
  snapshot: ChatSnapshot,
  userName: string,
  userCategory: string,
): string {
  const intentRules = chatTrainingData.intent_rules;
  const rules = Object.keys(intentRules)
    .map((key) => `* INTENT ${key.toUpperCase()}: ${intentRules[key]}`)
    .join("\n");

  return [
    `You are ${chatTrainingData.system_identity.name} for ${snapshot.chapterName}.`,
    `You are speaking directly with ${userName} (${userCategory}).`,
    "",
    flattenDirectives({
      system_identity: chatTrainingData.system_identity,
      core_directives: chatTrainingData.core_directives,
    }),
    "",
    buildTrainingSpec(),
    "",
    `---REAL-TIME CHAPTER SNAPSHOT FOR ${snapshot.chapterName}---`,
    JSON.stringify(snapshotToPromptDataset(snapshot), null, 0),
    "",
    `---INTENT ROUTING RULES---`,
    rules,
    "",
    `CRITICAL PRIVACY + DATA RULES:
1. DATA PRIMACY: Extract every name, score, zone, renewal stage, date and count ONLY from the snapshot above. NEVER invent member data.
2. PRIVACY: You never have phone numbers, emails, or internal IDs. If asked for one, say you do not have it in the snapshot.
3. NO IDs: Never output UUIDs, row IDs, or session IDs.
4. MARKDOWN: single asterisks *bold* only. Never double asterisks **.
5. AMBIGUITY: ask a counter-question with specific member choices from the snapshot.
6. AFFIRMATIVE: if the user says yes/sure/ok/do it, revisit the last AI reply and deliver exactly what was offered.
7. FOLLOW-UP: always end with a relevant 1-sentence follow-up question or action.
8. IDENTITY: identify yourself only as Chapter AI.`,
    "",
    "PREVIOUS CONVERSATION:",
  ].join("\n");
}

function formatHistory(history: ChatMessage[], userName: string): string {
  return (history ?? []).slice(-10)
    .map((m) => `${m.sender === "user" ? userName : "Chapter AI"}: ${m.text}`)
    .join("\n");
}

interface AskGeminiInput {
  prompt: string;
  snapshot: ChatSnapshot;
  userName: string;
  userCategory: string;
  history?: ChatMessage[];
  temperature?: number;
  regenerationDirective?: string;
}

export async function askGemini(input: AskGeminiInput): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const systemInstruction = buildSystemInstruction(
    input.snapshot,
    input.userName,
    input.userCategory,
  );

  const historyText = formatHistory(input.history ?? [], input.userName);

  const combinedPrompt = [
    systemInstruction,
    historyText || "None",
    "",
    input.regenerationDirective ?? `LATEST USER QUESTION: ${input.prompt}`,
  ].join("\n");

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: combinedPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: input.temperature ?? 0.2,
    },
  };

  for (const model of ACTIVE_GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;

      if (candidateText && candidateText.trim()) {
        return candidateText.replace(/\*\*/g, "*").trim();
      }
    } catch {
      continue;
    }
  }

  return null;
}