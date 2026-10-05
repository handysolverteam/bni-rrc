/**
 * Minimal in-memory sliding-window rate limiter for serverless route handlers. This is a
 * best-effort per-instance throttle (Vercel may run several lambdas), not a hard quota —
 * which is exactly what the chat endpoint needs: enough to stop a single caller from
 * hammering the Gemini key, without the cost/complexity of a shared store.
 */
export interface RateLimiter {
  isRateLimited(key: string): boolean;
}

export function createRateLimiter(max = 30, windowMs = 60_000): RateLimiter {
  const buckets = new Map<string, number[]>();

  return {
    isRateLimited(key: string): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;
      const timestamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

      if (timestamps.length >= max) {
        buckets.set(key, timestamps);
        return true;
      }

      timestamps.push(now);
      buckets.set(key, timestamps);

      if (buckets.size > 10_000) {
        for (const [bucketKey, bucket] of buckets) {
          const live = bucket.filter((t) => t > Date.now() - windowMs);
          if (live.length === 0) buckets.delete(bucketKey);
          else buckets.set(bucketKey, live);
        }
      }

      return false;
    },
  };
}

/** Shared limiter for /api/chat/generate, keyed by the caller's uid. */
export const chatRateLimiter = createRateLimiter();