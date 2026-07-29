/**
 * The shape of the code we email people.
 *
 * Twelve characters, drawn from Crockford's base32 alphabet and shown in three
 * groups of four: `A1B2-C3D4-E5F6`. Long enough that guessing is hopeless
 * (32^12, about 60 bits) and shaped so that a person can read it off a phone
 * and type it into a laptop without losing their place.
 *
 * Crockford's alphabet is the reason this is typeable at all. It leaves out the
 * four characters people confuse — `I`, `L`, `O`, `U` — so a code can never
 * contain the pair that would make someone guess. `normalise` then folds the
 * mistakes anyone still makes back in: a typed `O` becomes `0`, a typed `I` or
 * `L` becomes `1`, case does not matter, and the dashes are decoration that can
 * be typed, omitted, or replaced with spaces.
 *
 * This module is imported by the client — it holds no secrets and does no
 * crypto. Generating and checking codes lives in `auth-code-store.ts`, which is
 * server-only.
 */

/** Crockford base32: 0-9 and A-Z without I, L, O, U. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const CODE_LENGTH = 12;
const GROUP = 4;

/** `A1B2-C3D4-E5F6` — 12 characters plus two dashes. */
export const DISPLAY_LENGTH = CODE_LENGTH + Math.ceil(CODE_LENGTH / GROUP) - 1;

/**
 * Everything a person might type, reduced to the twelve characters we compare.
 *
 * Deliberately forgiving: whoever is doing this has already opened their email,
 * and rejecting `wish-it` for its dash — or `l` for the `1` it is drawn as in
 * half the fonts in the world — buys nothing.
 */
export function normalise(input: string): string {
  return input
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .split('')
    .filter((char) => ALPHABET.includes(char))
    .join('');
}

/** Groups a normalised code for display: `A1B2-C3D4-E5F6`. */
export function format(code: string): string {
  return (code.match(new RegExp(`.{1,${GROUP}}`, 'g')) ?? []).join('-');
}

/** Re-groups as someone types, so the field always reads the way the email does. */
export function formatPartial(input: string): string {
  return format(normalise(input).slice(0, CODE_LENGTH));
}

export function isComplete(input: string): boolean {
  return normalise(input).length === CODE_LENGTH;
}
