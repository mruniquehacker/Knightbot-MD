'use strict';

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return Object.freeze({
    allow(key, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (current.count >= max) return false;
      current.count += 1;
      return true;
    },
    prune(now = Date.now()) {
      for (const [key, bucket] of buckets.entries()) if (bucket.resetAt <= now) buckets.delete(key);
    },
    clear() { buckets.clear(); },
  });
}

module.exports = { createRateLimiter };
