'use server';

import { z } from 'zod';
import { supabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { isMailConfigured, sendFeedbackEmail } from '@/lib/mail';
import { limitMessage, rateLimit } from '@/lib/rate-limit';

/**
 * "Report an issue" and "suggest something", from anywhere in the app.
 *
 * Two things shape this. It has to work while signed out, because the report
 * worth most is from the person who cannot get in — so the write goes through
 * the service role rather than as the user. And it has to survive a broken
 * mailbox: the row is stored first, the notification is sent after, and a
 * failed send never loses the report.
 *
 * The service role is used for exactly this one non-financial table. `user_id`
 * is taken from the session, never from the form, so a report cannot be filed
 * in somebody else's name.
 */

export interface FeedbackState {
  error?: string;
  sent?: boolean;
}

const report = z.object({
  kind: z.enum(['issue', 'suggestion']),
  message: z
    .string()
    .trim()
    .min(4, { error: 'Tell us a little more than that.' })
    .max(4000, { error: 'That is longer than we can store — trim it a little.' }),
  page: z.string().max(500).optional(),
  errorDigest: z.string().max(120).optional(),
  contactEmail: z.union([z.email(), z.literal('')]).optional(),
});

export async function submitFeedback(
  _previous: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const parsed = report.safeParse({
    kind: String(formData.get('kind') ?? 'issue'),
    message: String(formData.get('message') ?? ''),
    page: String(formData.get('page') ?? '').slice(0, 500) || undefined,
    errorDigest: String(formData.get('error_digest') ?? '') || undefined,
    contactEmail: String(formData.get('contact_email') ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (!isAdminConfigured) {
    // The local JSON store has nowhere to put this, and pretending otherwise
    // would swallow the report.
    return {
      error:
        'Feedback needs the Supabase connection, which this instance does not have.',
    };
  }

  const user = await currentUser();
  const from = user?.email ?? parsed.data.contactEmail ?? null;

  // Keyed on whoever we can identify. Anonymous reports share a bucket, which
  // is the point: an unauthenticated form is the one worth flooding.
  const limit = await rateLimit('signup', `feedback:${from ?? 'anonymous'}`);
  if (!limit.allowed) return { error: limitMessage(limit) };

  const { error } = await supabaseAdmin()
    .from('feedback')
    .insert({
      user_id: user?.id ?? null,
      kind: parsed.data.kind,
      message: parsed.data.message,
      page: parsed.data.page ?? null,
      error_digest: parsed.data.errorDigest ?? null,
      contact_email: from,
      user_agent: String(formData.get('user_agent') ?? '').slice(0, 400) || null,
    });

  if (error) {
    console.error('[feedback] could not store report:', error.message);
    return { error: 'We could not save that just now. Try again shortly.' };
  }

  if (isMailConfigured) {
    try {
      await sendFeedbackEmail({
        kind: parsed.data.kind,
        message: parsed.data.message,
        from,
        page: parsed.data.page ?? null,
        errorDigest: parsed.data.errorDigest ?? null,
        userAgent: String(formData.get('user_agent') ?? '') || null,
      });
    } catch (mailError) {
      // Stored is what matters. A mail failure is ours to notice, not theirs.
      console.error('[feedback] stored but not emailed:', mailError);
    }
  }

  return { sent: true };
}
