'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FeedbackForm } from '@/components/feedback';
import { Button } from '@/components/ui';

/**
 * What a tester sees when something throws.
 *
 * Next replaces a server error's message with a digest before it reaches the
 * browser — deliberately, since the message can name a table or a key. That
 * left the person looking at "Application error: a client-side exception has
 * occurred", which tells them nothing and tells us less.
 *
 * So: plain language about what happened, the digest shown rather than hidden
 * because it is the string that joins their report to the server log, a way to
 * try again, and the report form right there while the memory is fresh.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client errors never reach the server log on their own.
    console.error('[wishit] page error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <p className="eyebrow text-bad">Something broke</p>
      <h1 className="mt-2 font-display text-[30px] leading-none">
        That did not work.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        The page stopped rather than show you a number it was not sure about.
        Nothing you had already saved is lost.
      </p>

      {error.digest && (
        <p className="mt-4 border border-line bg-surface px-3 py-2 text-[12px] text-ink-faint">
          Reference <code className="text-ink">{error.digest}</code> — quoting
          this lets us find the exact failure in the log.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex items-center border border-line-strong px-4 py-2 text-[13px] font-medium uppercase tracking-[0.06em] text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Back to the dashboard
        </Link>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <p className="eyebrow">Tell us what you were doing</p>
        <p className="mb-3 mt-1 text-[13px] text-ink-faint">
          One line is enough. It arrives with the reference above attached.
        </p>
        {/*
          Signed-in state is unknowable here — an auth failure is one of the
          ways to land on this page — so the address field is always offered.
        */}
        <FeedbackForm errorDigest={error.digest} signedIn={false} />
      </div>
    </div>
  );
}
