import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/next-path';

/**
 * Where Google comes back to.
 *
 * The consent screen returns a one-time code, not a session. This trades it for
 * one through the same cookie-backed client the rest of the server uses, so the
 * tokens land in httpOnly cookies and the proxy picks the session up on the very
 * next request.
 *
 * A route handler rather than a page: cookies have to be written before anything
 * renders, and there is nothing to render — this is a redirect with a side
 * effect.
 *
 * No profile is created here. `getProfile` makes one on first read for every
 * account however it signed in, which is one code path instead of two that have
 * to agree.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get('next'));

  // Google's own refusal — the consent screen was cancelled, usually.
  const denied = searchParams.get('error');
  if (denied) {
    return NextResponse.redirect(
      `${origin}/login?error=${denied === 'access_denied' ? 'cancelled' : 'google'}`,
    );
  }

  const code = searchParams.get('code');
  if (!code) return NextResponse.redirect(`${origin}/login?error=google`);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=google`);

  return NextResponse.redirect(`${origin}${next}`);
}
