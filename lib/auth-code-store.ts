import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
  scrypt,
} from 'node:crypto';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { ALPHABET, CODE_LENGTH, format, normalise } from '@/lib/auth-code';

/**
 * Our own twelve-character code, laid over the numeric one Supabase mints.
 *
 * Supabase's `email_otp` is digits only and at most ten of them, so a code that
 * looks like GitHub's cannot come from it. What comes out of `generateLink` is
 * therefore never emailed: it is sealed into a row here, and the code that goes
 * in the email is one we generated. Redeeming ours hands the numeric one back,
 * and that is what actually mints the session — Supabase stays the only thing
 * that decides whether somebody is signed in.
 *
 * The row cannot verify anyone on its own. The numeric OTP is encrypted under a
 * key derived from the emailed code, which is never stored in any form, so a
 * dump of this table is a pile of ciphertext with no keys next to it. Getting a
 * recovery OTP out of it means guessing 60 bits through scrypt.
 *
 * Unlike the rate limiter, this fails closed. A limiter that breaks open costs
 * quota; a code check that breaks open is not a code check.
 */

const TABLE = 'auth_code';

/** Matches the wording in the email, and must not outlive Supabase's own OTP. */
export const CODE_TTL_MINUTES = 60;

/** Wrong guesses before the code is burnt. Generous for typing, useless for guessing. */
const MAX_ATTEMPTS = 6;

const KEY_BYTES = 32;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function keyFrom(code: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, KEY_BYTES, SCRYPT, (error, key) =>
      error ? reject(error) : resolve(key as Buffer),
    );
  });
}

/**
 * A fresh code. `randomInt` rather than `randomBytes` modulo the alphabet:
 * 256 does not divide 32 evenly in general and a biased code is a shorter code.
 */
function mint(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export type Purpose = 'signup' | 'recovery';

/**
 * Seals `otp` under a new code and returns that code, grouped for the email.
 *
 * Any code already outstanding for the address is burnt first: asking for a new
 * one has to make the old email useless, or "send another code" quietly widens
 * the window instead of replacing it.
 */
export async function issueCode(
  purpose: Purpose,
  email: string,
  otp: string,
): Promise<string | null> {
  if (!isAdminConfigured) return null;

  const subject = email.trim().toLowerCase();
  const code = mint();
  const salt = randomBytes(16);
  const iv = randomBytes(12);

  const key = await keyFrom(code, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);

  const db = supabaseAdmin();
  await db
    .from(TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq('subject', subject)
    .is('consumed_at', null);

  const { error } = await db.from(TABLE).insert({
    subject,
    purpose,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    sealed_otp: sealed.toString('hex'),
    auth_tag: cipher.getAuthTag().toString('hex'),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });

  if (error) {
    console.error('[auth] could not store code:', error.message);
    return null;
  }

  return format(code);
}

export type Redemption =
  | { ok: true; otp: string }
  | { ok: false; reason: 'none' | 'wrong' | 'burnt' | 'unavailable' };

/**
 * Trades a typed code for the numeric OTP it was sealed around.
 *
 * The row is found by address alone, not by any hash of the code — there is
 * nothing to look a code up by, which is the point. Proof is the GCM tag: if
 * the key derived from what was typed is wrong, `final()` throws, and no
 * comparison we wrote could have leaked timing.
 */
export async function redeemCode(
  email: string,
  typed: string,
): Promise<Redemption> {
  if (!isAdminConfigured) return { ok: false, reason: 'unavailable' };

  const code = normalise(typed);
  if (code.length !== CODE_LENGTH) return { ok: false, reason: 'wrong' };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from(TABLE)
    .select('id, salt, iv, sealed_otp, auth_tag, attempts')
    .eq('subject', email.trim().toLowerCase())
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[auth] could not read code:', error.message);
    return { ok: false, reason: 'unavailable' };
  }
  if (!data) return { ok: false, reason: 'none' };
  if ((data.attempts as number) >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'burnt' };
  }

  const key = await keyFrom(code, Buffer.from(data.salt as string, 'hex'));
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(data.iv as string, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(data.auth_tag as string, 'hex'));

  let otp: string;
  try {
    otp = Buffer.concat([
      decipher.update(Buffer.from(data.sealed_otp as string, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    const attempts = (data.attempts as number) + 1;
    // Burnt on the last miss rather than left to expire: a guessing run gets
    // six tries per email sent, not six per hour.
    await db
      .from(TABLE)
      .update({
        attempts,
        ...(attempts >= MAX_ATTEMPTS
          ? { consumed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', data.id);
    return { ok: false, reason: attempts >= MAX_ATTEMPTS ? 'burnt' : 'wrong' };
  }

  // Consumed before the OTP is handed back, not after it works: a code spent
  // once must not be replayable while Supabase thinks about it.
  await db
    .from(TABLE)
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.id);

  return { ok: true, otp };
}
