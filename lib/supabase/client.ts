'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase, used only for signing out and reading auth state.
 * All data access happens on the server; the publishable key can read nothing
 * on its own because every table's RLS policy requires a matching user.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
