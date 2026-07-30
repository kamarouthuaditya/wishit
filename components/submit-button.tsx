'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';

/**
 * A submit button that admits it is working.
 *
 * Every form in onboarding posts to a Server Action that reads the profile,
 * writes it, revalidates and redirects — four round trips to a database that is
 * not in this room. Nothing on screen said so: the button stayed lit and idle,
 * so the honest reading of a click was that it had missed, and the reasonable
 * response was to click again.
 *
 * `useFormStatus` has to be read from a component *inside* the form rather than
 * the one that renders it, which is the only reason this is its own file.
 *
 * The label swap is the part that carries the message, not the spinner. The
 * stylesheet's `prefers-reduced-motion` block flattens every animation in the
 * app to 0.01ms, so for those readers a spinner would sit frozen and look like
 * a bug — it is hidden there, and the changed word still says everything.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className = '',
  disabled,
}: {
  children: ReactNode;
  /** What the button says while the action is in flight. */
  pendingLabel: string;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending || disabled}
      // Tells a screen reader the control is busy rather than simply dead.
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/**
 * The same idea for the bare text submits — the `Remove` beside a row.
 *
 * These are not `Button`s and should not become them: they are deliberately
 * quiet, because deleting a line you just typed is not the thing the step is
 * for. Quiet still has to answer a click, though.
 */
export function SubmitText({
  children,
  pendingLabel,
  className = '',
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={
        'cursor-pointer text-[12px] text-ink-faint transition-colors duration-[140ms] ' +
        `hover:text-bad disabled:cursor-not-allowed disabled:opacity-60 ${className}`
      }
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      aria-hidden
      className="animate-spin motion-reduce:hidden"
    >
      {/* The track, then the arc that travels over it. */}
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
