import type { User } from '@supabase/supabase-js';

/**
 * What to call somebody, from whichever sign-in they used.
 *
 * The email sign-up writes `first_name` and `last_name` itself. Google writes
 * its own set — `given_name`, `family_name`, `full_name`, `name` — and reading
 * only ours meant a Google account arrived at onboarding as an empty field, and
 * stayed `Me` in the profile if they skipped it.
 *
 * Order matters: our own fields win, because they are what the person typed
 * about themselves rather than what an identity provider holds on file.
 */
export function nameFromUser(user: User | null | undefined): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const text = (key: string) => {
    const value = meta[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  const ours = [text('first_name'), text('last_name')].filter(Boolean).join(' ');
  if (ours) return ours;

  const google = [text('given_name'), text('family_name')].filter(Boolean).join(' ');
  if (google) return google;

  return text('full_name') || text('name');
}
