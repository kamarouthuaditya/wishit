'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { currentUser, supabaseServer } from '@/lib/supabase/server';

/**
 * Closing the account, for real.
 *
 * Deleting the auth user is enough to delete the data: every table's `user_id`
 * is declared `references auth.users(id) on delete cascade` (migration 0006),
 * so Postgres removes the rows in the same statement. Doing it that way rather
 * than by looping over tables means a table added later cannot be forgotten
 * here — it inherits the cascade when it inherits the column.
 *
 * Feedback is the one exception, by design: it is `on delete set null`, so a
 * report survives its author. What is kept is the sentence they wrote about
 * the app, with no account attached to it.
 */

export interface DeleteState {
  error?: string;
}

export async function deleteAccount(
  _previous: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  if (!isAdminConfigured) {
    return {
      error: 'This instance cannot delete accounts: it has no service-role key.',
    };
  }

  // Typing the address is the confirmation. A checkbox is too easy to click on
  // a phone, and this is the one action in the app with no undo.
  const typed = String(formData.get('confirm_email') ?? '').trim().toLowerCase();
  if (typed !== (user.email ?? '').toLowerCase()) {
    return { error: 'That is not the address on this account.' };
  }

  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[account] deletion failed:', error.message);
    return { error: 'We could not delete the account just now. Try again shortly.' };
  }

  // The rows are gone; the cookie is not. Clearing it here means the redirect
  // lands on a sign-in page rather than on a session pointing at nothing.
  await (await supabaseServer()).auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login?deleted=1');
}
