import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { safeNext } from '@/lib/next-path';

/**
 * The Google handshake, run by us rather than relayed through Supabase.
 *
 * Supabase's own `signInWithOAuth` works and is less code, but it sends the
 * browser to `<project-ref>.supabase.co` — and Google names the host it is
 * about to return to on the consent screen. Somebody signing in to Wishit was
 * asked to trust a string of random letters, which is exactly the shape of the
 * thing people are told not to click.
 *
 * So the consent screen points at this app's own domain. We trade the code for
 * an ID token ourselves and hand that to `signInWithIdToken`, which verifies
 * Google's signature and mints the session. Supabase still owns the account;
 * only the redirect belongs to us.
 */

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();

/**
 * Whether this deployment can offer Google at all. The buttons are hidden when
 * it cannot — a button that always fails is worse than no button.
 */
export const isGoogleConfigured = Boolean(clientId && clientSecret);

/** Random, URL-safe, and long enough that guessing is not a strategy. */
function token(): string {
  return randomBytes(32).toString('base64url');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface Handshake {
  /** Where to send the browser. */
  url: string;
  /** Echoed back by Google; proves the reply belongs to the request we made. */
  state: string;
  /** Kept raw for Supabase. Google only ever sees its SHA-256. */
  nonce: string;
}

/**
 * The consent URL, plus the two secrets that have to survive the round trip.
 *
 * `state` is CSRF cover: without it, anyone could feed this app a code of their
 * own choosing and sign a visitor into an account they control.
 *
 * `nonce` binds the ID token to this one handshake, so a token minted for some
 * other request cannot be replayed here. Google is given the hash and puts it
 * in the token; Supabase is given the original and checks that it hashes to
 * what the token claims — which is why the raw value never leaves our cookies.
 */
export function beginHandshake(redirectUri: string): Handshake {
  const state = token();
  const nonce = token();

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    // No Google API is called afterwards, so this is the whole ask: who they
    // are, and what to call them. Anything more would be asked for and unused.
    scope: 'openid email profile',
    state,
    nonce: sha256Hex(nonce),
    // Otherwise a browser signed into one Google account skips the chooser,
    // which is wrong on a shared machine and maddening on a personal one with
    // two accounts.
    prompt: 'select_account',
  });

  return { url: `${AUTHORIZE}?${params}`, state, nonce };
}

/**
 * Where this deployment lives, from the request itself.
 *
 * Vercel serves the same build on a project domain, a branch domain and every
 * preview URL, and Google will only return to the address it was sent from, so
 * a hard-coded origin would break every deployment but one.
 * `NEXT_PUBLIC_SITE_URL` wins when it is set, for the case where one domain has
 * to be canonical.
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const protocol =
    head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

/**
 * Where Google is told to come back to. Every host this build answers on needs
 * its own entry in the Google console's authorised redirect list — including
 * `http://localhost:3000/auth/callback` for development.
 */
export async function googleRedirectUri(): Promise<string> {
  return `${await siteOrigin()}/auth/callback`;
}

/** What has to survive the trip to Google and back. */
export interface ParkedHandshake {
  state: string;
  nonce: string;
  /** Where to land once the session exists. Always a path — never a URL. */
  next: string;
  redirectUri: string;
}

const HANDSHAKE_COOKIE = 'wishit_google';

export async function parkHandshake(handshake: ParkedHandshake): Promise<void> {
  (await cookies()).set(HANDSHAKE_COOKIE, JSON.stringify(handshake), {
    httpOnly: true,
    // Not `strict`: the return from Google is a cross-site navigation, and a
    // strict cookie would be withheld on exactly the request that needs it.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // Long enough to read a consent screen, short enough that an abandoned
    // attempt is not still standing tomorrow.
    maxAge: 10 * 60,
    path: '/',
  });
}

/**
 * Reads the handshake back and clears it in the same breath: one consent
 * screen, one code, one use. A second visit to the callback with the same code
 * finds nothing to check it against and is turned away.
 */
export async function takeHandshake(): Promise<ParkedHandshake | null> {
  const jar = await cookies();
  const raw = jar.get(HANDSHAKE_COOKIE)?.value;
  jar.delete(HANDSHAKE_COOKIE);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { state, nonce, redirectUri, next } = parsed;
    if (
      typeof state !== 'string' ||
      typeof nonce !== 'string' ||
      typeof redirectUri !== 'string'
    ) {
      return null;
    }
    return {
      state,
      nonce,
      redirectUri,
      next: safeNext(typeof next === 'string' ? next : null),
    };
  } catch {
    return null;
  }
}

/** Constant-time, because a `===` on a secret leaks its prefix by timing. */
export function sameToken(a: string | undefined, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Trades the one-time code for an ID token.
 *
 * Server to server with the client secret, over a connection to Google — the
 * code that came back through the browser is worthless without this half.
 * Returns null on any failure; the caller has one thing to say either way and
 * the reason belongs in the log, not in a query string.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        // Google requires this to be identical to the one the consent screen
        // was opened with, and checks it against the registered list again.
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });
  } catch (cause) {
    console.error('[auth] Google token endpoint unreachable:', cause);
    return null;
  }

  if (!response.ok) {
    // The body names the misconfiguration — redirect_uri_mismatch, bad secret —
    // which is for us to read in the logs and never for the browser to see.
    console.error(
      `[auth] Google token exchange failed (${response.status}):`,
      await response.text().catch(() => ''),
    );
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    id_token?: unknown;
  } | null;

  const idToken = body?.id_token;
  if (typeof idToken !== 'string' || !idToken) {
    console.error('[auth] Google returned no ID token.');
    return null;
  }

  return idToken;
}
