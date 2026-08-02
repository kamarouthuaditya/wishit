'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { submitFeedback, type FeedbackState } from '@/lib/feedback-actions';
import { IconAlert, IconClose, IconNote } from '@/components/icons';
import { Button, Field, Input, Textarea } from '@/components/ui';

/**
 * "Something is wrong" and "you should have thought of this", from wherever the
 * person is standing when they think it.
 *
 * The two are one form because they are one impulse. What differs is the tone
 * of the reply they should expect, so the kind is a choice inside the form
 * rather than two entry points to hunt between.
 *
 * The page URL, the browser and — from an error screen — the error digest are
 * attached without being asked for. A report that says "it broke" is worth
 * something only if it carries where and when.
 */

const EMPTY: FeedbackState = {};

export function FeedbackForm({
  errorDigest,
  defaultKind = 'issue',
  signedIn,
  onDone,
}: {
  errorDigest?: string;
  defaultKind?: 'issue' | 'suggestion';
  /** A signed-out reporter is asked for an address; a signed-in one is not. */
  signedIn: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(submitFeedback, EMPTY);
  const [kind, setKind] = useState(defaultKind);

  useEffect(() => {
    if (!state.sent || !onDone) return;
    // Long enough to read "thank you", short enough not to be a modal.
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [state.sent, onDone]);

  /**
   * Where the report came from, attached at submit rather than rendered as
   * hidden state: the router can move under this form, and reading the address
   * bar once at mount would then send the wrong page.
   */
  const submit = (formData: FormData) => {
    formData.set('page', window.location.pathname + window.location.search);
    formData.set('user_agent', navigator.userAgent);
    return action(formData);
  };

  if (state.sent) {
    return (
      <p className="rounded-xl bg-good-soft px-4 py-3 text-[14px] text-good">
        Sent. Thank you — that is genuinely useful.
      </p>
    );
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {errorDigest && (
        <input type="hidden" name="error_digest" value={errorDigest} />
      )}

      <div className="flex gap-2" role="radiogroup" aria-label="Kind of feedback">
        {(['issue', 'suggestion'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => setKind(option)}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 border px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] transition-all ${
              kind === option
                ? 'border-accent bg-accent-soft/40 text-accent'
                : 'border-line-strong text-ink-faint hover:text-ink'
            }`}
          >
            {option === 'issue' ? <IconAlert size={14} /> : <IconNote size={14} />}
            {option === 'issue' ? 'Issue' : 'Suggestion'}
          </button>
        ))}
      </div>

      <Field
        label={kind === 'issue' ? 'What happened?' : 'What would you change?'}
        hint={
          kind === 'issue'
            ? 'What you were doing, and what you expected instead.'
            : 'Rough is fine. Half an idea is still an idea.'
        }
      >
        <Textarea
          name="message"
          rows={4}
          required
          maxLength={4000}
          autoFocus
          placeholder={
            kind === 'issue'
              ? 'I tried to log a spend on the 1st and it went into last month…'
              : 'The goals page would be easier if…'
          }
        />
      </Field>

      {!signedIn && (
        <Field label="Email" hint="Only so we can reply. Leave it blank to stay anonymous.">
          <Input type="email" name="contact_email" placeholder="you@example.com" />
        </Field>
      )}

      {state.error && (
        <p role="alert" className="text-[14px] text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}

/**
 * The always-there entry point. A quiet link, because it should be findable at
 * the moment of irritation and invisible the rest of the time.
 */
export function FeedbackLink({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="cursor-pointer text-[13px] text-ink-faint underline-offset-4 transition-colors hover:text-accent hover:underline"
      >
        Report an issue or suggest something
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Feedback"
          className="rise absolute bottom-[calc(100%+0.6rem)] left-0 z-50 w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl bg-surface p-4 shadow-lg ring-1 ring-line-strong/60"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">Tell us</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer p-1 text-ink-faint transition-colors hover:bg-surface-lift hover:text-ink"
              aria-label="Close"
            >
              <IconClose size={15} />
            </button>
          </div>
          <FeedbackForm signedIn={signedIn} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
