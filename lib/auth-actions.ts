'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isMailConfigured, sendCodeEmail } from '@/lib/mail';
import { issueCode, redeemCode, type Redemption } from '@/lib/auth-code-store';
import { limitMessage, rateLimit } from '@/lib/rate-limit';

/**
 * Sign up, sign in, sign out. Everything happens in a Server Action, so a
 * password only ever exists in the request body — it is never sent to a client
 * component, never in a URL, never in a log line.
 */

export interface AuthState {
  error?: string;
  notice?: string;
  /** Which field to point at, when the failure is about one. */
  field?: 'email' | 'password' | 'name';
}

const credentials = z.object({
  email: z.email({ error: 'That does not look like an email address.' }),
  password: z
    .string()
    .min(8, { error: 'Passwords need at least 8 characters.' }),
});

function parse(formData: FormData) {
  return credentials.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });
}

function firstIssue(result: ReturnType<typeof parse>): AuthState {
  const issue = result.success ? null : result.error.issues[0];
  return {
    error: issue?.message ?? 'Check the details and try again.',
    field: issue?.path[0] === 'password' ? 'password' : 'email',
  };
}

export async function signIn(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parse(formData);
  if (!parsed.success) return firstIssue(parsed);

  // Slows password guessing against one address. Checked before the password is
  // ever tested, so a blocked caller learns nothing from how long it took.
  const limit = await rateLimit('signin', parsed.data.email);
  if (!limit.allowed) return { error: limitMessage(limit) };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: saying which half was wrong tells an attacker which
    // addresses have accounts.
    return { error: 'That email and password do not match an account.' };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/** Where the address being verified is parked between the two steps. */
const PENDING_EMAIL = 'wishit_pending_email';

export async function signUp(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials
    .extend({
      confirm: z.string(),
      first_name: z
        .string()
        .min(1, { error: 'What should we call you?' })
        .max(60)
        .trim(),
      last_name: z.string().max(60).trim(),
    })
    .refine((value) => value.password === value.confirm, {
      error: 'Those two passwords are not the same.',
      path: ['confirm'],
    })
    .safeParse({
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      confirm: String(formData.get('confirm') ?? ''),
      first_name: String(formData.get('first_name') ?? '').trim(),
      last_name: String(formData.get('last_name') ?? '').trim(),
    });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path[0];
    return {
      error: issue.message,
      field:
        path === 'email' ? 'email' : path === 'first_name' ? 'name' : 'password',
    };
  }

  const sent = await mintAndSend('signup', parsed.data.email, parsed.data.password, {
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
  });
  if (sent.error) return sent;

  await parkEmail(parsed.data.email);
  redirect('/signup/verify');
}

/**
 * Mints a one-time code through the admin API and mails it ourselves.
 *
 * `generateLink` creates the code without asking Supabase to send anything,
 * which is the whole point: delivery goes over our own SMTP, and the wording
 * lives in this repository rather than in a dashboard template.
 */
async function mintAndSend(
  type: 'signup' | 'recovery',
  email: string,
  password?: string,
  /** Carried into the account so the app has a name to greet you by. */
  metadata?: Record<string, string>,
): Promise<AuthState> {
  if (!isMailConfigured) {
    return {
      error:
        'Email is not configured on this deployment, so no code can be sent.',
    };
  }

  // One Gmail account sends every code in this app, and it has a daily quota.
  // Three an hour per address keeps a loop from spending it, and keeps a
  // mailbox from filling with codes nobody asked for.
  const limit = await rateLimit(type, email);
  if (!limit.allowed) return { error: limitMessage(limit) };

  const { data, error } = await supabaseAdmin().auth.admin.generateLink(
    type === 'signup'
      ? { type: 'signup', email, password: password!, options: { data: metadata } }
      : { type: 'recovery', email },
  );

  if (error) {
    // "already registered" is the one worth saying plainly: the person is
    // trying to sign up and needs to be told to sign in instead.
    if (/already/i.test(error.message)) {
      return { error: 'That email already has an account. Sign in instead.', field: 'email' };
    }
    // Anything else is Supabase talking to us, not to the person at the form:
    // it can name internal configuration and it changes between versions.
    console.error(`[auth] ${type} code minting failed:`, error.message);
    return { error: 'We could not start that just now. Try again shortly.' };
  }

  const otp = data.properties?.email_otp;
  if (!otp) return { error: 'Could not generate a code. Try again in a moment.' };

  // Supabase's numeric OTP never leaves the server. What gets emailed is our
  // own twelve-character code, with the numeric one sealed under it.
  const code = await issueCode(type, email, otp);
  if (!code) {
    return { error: 'We could not start that just now. Try again shortly.' };
  }

  try {
    await sendCodeEmail({
      to: email,
      code,
      purpose: type === 'signup' ? 'sign-up' : 'password-reset',
    });
  } catch {
    // Never echo the SMTP error: it can carry the sending address and the
    // rejection reason straight to whoever typed the form.
    return { error: 'We could not send the email just now. Try again shortly.' };
  }

  return {};
}

/**
 * Parks the address being verified in an httpOnly cookie rather than a query
 * string — an email in a URL ends up in history, logs, and any referrer that
 * follows it.
 */
async function parkEmail(email: string): Promise<void> {
  (await cookies()).set(PENDING_EMAIL, email, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
  });
}

/** The address a code was just sent to, for the verify screen to name. */
export async function pendingEmail(): Promise<string | null> {
  return (await cookies()).get(PENDING_EMAIL)?.value ?? null;
}

/** What a failed redemption should say. Never mentions how close a guess was. */
function redemptionError(reason: Exclude<Redemption, { ok: true }>['reason']): string {
  switch (reason) {
    case 'none':
      return 'That code has expired. Ask for a new one.';
    case 'burnt':
      return 'Too many wrong tries. Ask for a new code.';
    case 'unavailable':
      return 'We could not check that just now. Try again shortly.';
    default:
      return 'That code is wrong or has expired. Check the latest email.';
  }
}

/**
 * Trades the emailed code for a session.
 *
 * Two steps, not one: our code unseals Supabase's numeric OTP, and that OTP is
 * what mints the session.
 */
export async function verifyEmail(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = await pendingEmail();
  if (!email) {
    return { error: 'That sign-up has expired. Start again and we will send a new code.' };
  }

  const redeemed = await redeemCode(email, String(formData.get('token') ?? ''));
  if (!redeemed.ok) return { error: redemptionError(redeemed.reason) };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: redeemed.otp,
    type: 'email',
  });

  if (error) {
    // The code was ours and it was right, so this is Supabase's own OTP having
    // expired underneath it — not something the person typed wrong.
    console.error('[auth] sign-up OTP rejected after a valid code:', error.message);
    return { error: 'That code has expired. Ask for a new one.' };
  }

  (await cookies()).delete(PENDING_EMAIL);
  revalidatePath('/', 'layout');
  // `created` is what turns a silent redirect into "your account exists and
  // you are signed in", said on the screen they land on.
  redirect('/welcome?created=1');
}

/** Sends another sign-up code to the same address. */
export async function resendCode(): Promise<AuthState> {
  const email = await pendingEmail();
  if (!email) return { error: 'Start the sign-up again to get a code.' };

  // A recovery code also confirms the address, and unlike a second signup code
  // it works whether or not the account was already created.
  const sent = await mintAndSend('recovery', email);
  if (sent.error) return sent;

  return { notice: `A new code is on its way to ${email}.` };
}

/**
 * Mails a reset code. Always reports the same thing, whether or not the address
 * has an account — this reply must not become a way to find out who is
 * registered.
 */
export async function requestPasswordReset(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const parsed = z.email().safeParse(email);
  if (!parsed.success) {
    return { error: 'That does not look like an email address.', field: 'email' };
  }

  const sent = await mintAndSend('recovery', email);
  // A missing account is not worth mentioning; a broken mailer is.
  if (sent.error && /configured|send the email/i.test(sent.error)) return sent;

  await parkEmail(email);
  redirect('/forgot-password/verify');
}

/** Trades a reset code for a session, so a new password can be set. */
export async function verifyResetCode(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = await pendingEmail();
  if (!email) {
    return { error: 'That request has expired. Ask for a new code.' };
  }

  const redeemed = await redeemCode(email, String(formData.get('token') ?? ''));
  if (!redeemed.ok) return { error: redemptionError(redeemed.reason) };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: redeemed.otp,
    type: 'recovery',
  });

  if (error) {
    console.error('[auth] reset OTP rejected after a valid code:', error.message);
    return { error: 'That code has expired. Ask for a new one.' };
  }

  (await cookies()).delete(PENDING_EMAIL);
  revalidatePath('/', 'layout');
  redirect('/account/password');
}

/** Sets a new password for whoever the recovery link signed in. */
export async function updatePassword(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const parsed = z
    .string()
    .min(8, { error: 'Passwords need at least 8 characters.' })
    .safeParse(password);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, field: 'password' };
  }
  if (password !== confirm) {
    return { error: 'Those two passwords are not the same.', field: 'password' };
  }

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      error: 'That reset link has expired. Ask for a new one and try again.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
