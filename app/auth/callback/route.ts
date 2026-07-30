import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { exchangeCode, sameToken, takeHandshake } from '@/lib/google-oauth';

/**
 * Where Google comes back to.
 *
 * The consent screen returns a one-time code, not a session. This trades it
 * with Google for an ID token, then hands that to Supabase, which verifies the
 * signature against Google's keys and mints the session. The tokens land in
 * httpOnly cookies through the same client the rest of the server uses, so the
 * proxy picks the session up on the very next request.
 *
 * A route handler rather than a page: cookies have to be written before
 * anything renders, and there is nothing to render — this is a redirect with a
 * side effect.
 *
 * No profile is created here. `getProfile` makes one on first read for every
 * account however it signed in, which is one code path instead of two that have
 * to agree.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Taken first and unconditionally: whatever happens next, this handshake is
  // spent, and leaving the cookie behind would leave a code replayable.
  const handshake = await takeHandshake();
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/login?error=${reason}`);

  // Google's own refusal — the consent screen was dismissed, usually.
  const denied = searchParams.get('error');
  if (denied) return fail(denied === 'access_denied' ? 'cancelled' : 'google');

  const code = searchParams.get('code');
  if (!code || !handshake) return fail('google');

  // The reply has to belong to the request this browser made. Without this
  // check, a code obtained elsewhere could be walked into a session here.
  if (!sameToken(handshake.state, searchParams.get('state'))) {
    console.error('[auth] Google callback state did not match.');
    return fail('google');
  }

  const idToken = await exchangeCode(code, handshake.redirectUri);
  if (!idToken) return fail('google');

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    // The raw value. Supabase hashes it and checks the result against the
    // token's own claim, which is what ties this token to this handshake.
    nonce: handshake.nonce,
  });

  if (error) {
    // Almost always configuration: the client ID missing from the provider's
    // authorised list in Supabase. Worth naming in the log, never in the URL.
    console.error('[auth] Supabase rejected the Google ID token:', error.message);
    return fail('google');
  }

  return NextResponse.redirect(`${origin}${handshake.next}`);
}
