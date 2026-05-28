/**
 * Lightweight server-side rate limiter.
 *
 * Uses a module-level Map for fast in-process checks (same serverless instance)
 * combined with Supabase audit_log for cross-instance burst protection on
 * expensive routes (AI calls, external API calls).
 *
 * Usage:
 *   const { limited, remaining } = await checkRateLimit(userId, 'copilot', 30, 60);
 *   if (limited) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
 */

// ── In-process sliding window (per serverless instance) ──────────────────────
const inProcessStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale keys every 5 minutes to avoid memory leaks
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, val] of inProcessStore) {
    if (now > val.resetAt) inProcessStore.delete(key);
  }
}

/**
 * Check rate limit using in-process store only (cheap, no DB).
 * Good for burst protection within a single instance.
 *
 * @param identifier - Unique key (e.g. userId + routeName)
 * @param limit      - Max requests per window
 * @param windowSec  - Window size in seconds
 * @returns { limited: boolean; remaining: number }
 */
export function checkRateLimitFast(
  identifier: string,
  limit: number,
  windowSec: number,
): { limited: boolean; remaining: number } {
  maybeCleanup();
  const now = Date.now();
  const resetAt = now + windowSec * 1000;

  const existing = inProcessStore.get(identifier);
  if (!existing || now > existing.resetAt) {
    inProcessStore.set(identifier, { count: 1, resetAt });
    return { limited: false, remaining: limit - 1 };
  }

  existing.count++;
  if (existing.count > limit) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: limit - existing.count };
}

/**
 * Check rate limit using Supabase audit_log for cross-instance protection.
 * Use for expensive routes (AI, external APIs).
 *
 * Reads recent audit_log entries for the user+action combination.
 * Does NOT write — the caller is responsible for logging actions.
 *
 * @param supabase   - Supabase server client
 * @param userId     - Auth user ID
 * @param action     - Action name to count (must be in ALLOWED_ACTIONS)
 * @param limit      - Max requests per window
 * @param windowSec  - Window size in seconds
 */
export async function checkRateLimitDb(
  supabase: { from: (table: string) => unknown },
  userId: string,
  action: string,
  limit: number,
  windowSec: number,
): Promise<{ limited: boolean; remaining: number }> {
  // Fast path: check in-process first
  const key = `${userId}:${action}`;
  const fast = checkRateLimitFast(key, limit, windowSec);
  if (fast.limited) return fast;

  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const db = supabase.from('audit_log') as {
      select: (cols: string, opts?: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          gte: (col: string, val: string) => Promise<{ count: number | null }>;
        };
      };
    };
    const { count } = await db
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', userId)
      .gte('created_at', since);

    const used = count ?? 0;
    if (used >= limit) {
      return { limited: true, remaining: 0 };
    }
    return { limited: false, remaining: limit - used };
  } catch {
    // If audit DB check fails, fall back to fast (in-process) result
    return fast;
  }
}
