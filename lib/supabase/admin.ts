import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The service-role client. It bypasses row level security, so it is used for
 * exactly one thing: minting sign-up and recovery codes without asking Supabase
 * to email them, because we send our own mail.
 *
 * Nothing that reads or writes a user's financial rows may come through here —
 * that all goes through `lib/db/driver.ts`, as the signed-in user.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isAdminConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!isAdminConfigured) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — sign-up codes cannot be minted.',
    );
  }
  if (!client) {
    client = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
