/**
 * Standard 500 responses for API route handlers. Routes must never echo internal
 * error text (Postgres/RTDB messages, stack traces, internal paths) back to callers
 * -- that leaks schema and setup details an attacker can pivot on. Log the real error
 * server-side and send a generic message instead.
 */
export function internalErrorResponse(error: unknown, fallback = "Something went wrong.", status = 500) {
  if (error instanceof Error) {
    console.error(`[api] ${error.stack ?? error.message}`);
  } else {
    console.error("[api] Non-Error thrown:", error);
  }
  return Response.json({ error: fallback }, { status });
}