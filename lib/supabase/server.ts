import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase as the signed-in user, not as the service role.
 *
 * Every query made through this client carries the user's JWT, so row level
 * security decides what it can see. That is the whole isolation model: there is
 * no `where user_id = ...` sprinkled through the app to forget one day, and a
 * bug in a query cannot leak another person's money.
 *
 * The service-role key stays out of this path entirely.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isAuthConfigured = Boolean(url && publishableKey);

export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(url!, publishableKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so nothing is lost by ignoring this.
        }
      },
    },
  });
}

/** The signed-in user, or null. Never throws — callers decide what that means. */
export async function currentUser() {
  if (!isAuthConfigured) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}
