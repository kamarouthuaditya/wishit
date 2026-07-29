import 'server-only';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';

/**
 * A ceiling on how often one address can make us mint a code and send an email.
 *
 * Every sign-up and every password reset goes out over a single Gmail account
 * with a daily quota. Without a limit, one loop empties that quota and the next
 * real tester cannot get in — and the address on the receiving end gets a
 * mailbox full of codes it never asked for.
 *
 * The counter lives in Postgres rather than in memory because the app runs as
 * serverless functions: an in-memory count is per instance, and per instance is
 * no limit at all.
 */

export interface Limit {
  /** How many attempts are allowed inside the window. */
  max: number;
  /** How long the window is, in minutes. */
  windowMinutes: number;
}

export const LIMITS: Record<'signup' | 'recovery' | 'signin', Limit> = {
  // Three codes an hour is more than a person who mistyped their address needs.
  signup: { max: 3, windowMinutes: 60 },
  recovery: { max: 3, windowMinutes: 60 },
  // Sign-in sends nothing, so this only slows password guessing.
  signin: { max: 10, windowMinutes: 15 },
};

export interface LimitResult {
  allowed: boolean;
  /** Minutes until the oldest attempt in the window falls out of it. */
  retryInMinutes: number;
}

const ALLOWED: LimitResult = { allowed: true, retryInMinutes: 0 };

/**
 * Records the attempt and says whether it may proceed.
 *
 * Fails open. If the limiter's own table is unreachable, a tester who cannot
 * sign up is a worse outcome than an unlimited one, and the mail provider's own
 * quota is still underneath us.
 */
export async function rateLimit(
  kind: keyof typeof LIMITS,
  subject: string,
): Promise<LimitResult> {
  if (!isAdminConfigured) return ALLOWED;

  const { max, windowMinutes } = LIMITS[kind];
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const key = subject.trim().toLowerCase();
  const db = supabaseAdmin();

  try {
    const { data, error } = await db
      .from('auth_attempt')
      .select('created_at')
      .eq('subject', key)
      .eq('kind', kind)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) return ALLOWED;

    const attempts = data ?? [];
    if (attempts.length >= max) {
      const oldest = new Date(attempts[0].created_at as string).getTime();
      const freeAt = oldest + windowMinutes * 60_000;
      return {
        allowed: false,
        retryInMinutes: Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000)),
      };
    }

    // Recorded only once the attempt is allowed, so a blocked caller cannot
    // extend their own lockout by hammering it.
    await db.from('auth_attempt').insert({ subject: key, kind });
    return ALLOWED;
  } catch {
    return ALLOWED;
  }
}

/** The message a blocked caller sees. Says nothing about whether the address exists. */
export function limitMessage(result: LimitResult): string {
  return `Too many attempts. Try again in ${result.retryInMinutes} minute${
    result.retryInMinutes === 1 ? '' : 's'
  }.`;
}
