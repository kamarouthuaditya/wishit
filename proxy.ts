import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isProduction } from '@/lib/env';

/**
 * Refreshes the Supabase session on every request and keeps signed-out visitors
 * out of the app.
 *
 * This is a redirect for the look of the thing, not the security boundary —
 * Next's own guidance is that proxies are for optimistic checks. The real
 * boundary is row level security in Postgres: without a session, every query
 * returns nothing at all.
 */

// `/forgot-password` and its verify step have to be reachable without a
// session — they are the way back in for someone who cannot sign in.
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Deployed without Supabase, the app would serve one shared, sign-in-free
    // ledger to everybody. Nothing renders until that is fixed.
    if (isProduction) {
      return new NextResponse(
        'Wishit is not configured on this deployment. Set NEXT_PUBLIC_SUPABASE_URL ' +
          'and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see docs/DEPLOY.md).',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }
    // In development this is the local JSON store: there is nobody to sign in as.
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser, not getSession: this revalidates the token with Supabase rather
  // than trusting a cookie the browser handed us.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = '/login';
    // Come back to where they were headed once they are in.
    target.searchParams.set('next', pathname);
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images — those need no session and
     * would only add a round trip to Supabase.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
