/**
 * In-memory sliding-window rate limiter. No Redis in this architecture
 * (§0 "Three decisions") — a single self-hosted Node process is the deployed
 * shape, so an in-process map is correct and needs nothing to install.
 * Resets on process restart, which is acceptable for a webhook ingress guard.
 */
const buckets = new Map<string, number[]>();

const MAX_BUCKETS = 10_000; // hard ceiling so a spoofed-IP flood can't grow this unboundedly

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let timestamps = buckets.get(key);

  if (!timestamps) {
    if (buckets.size >= MAX_BUCKETS) {
      // Evict the oldest bucket rather than let the map grow forever.
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    timestamps = [];
    buckets.set(key, timestamps);
  }

  const cutoff = now - windowMs;
  const fresh = timestamps.filter((t) => t > cutoff);
  fresh.push(now);
  buckets.set(key, fresh);

  return fresh.length > limit;
}
