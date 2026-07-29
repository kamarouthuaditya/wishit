'use client';

import { useEffect } from 'react';

/**
 * The last resort: an error in the root layout itself, where the app's own
 * chrome — and its stylesheet — never mounted.
 *
 * Everything here is inline. A page that renders because the layout failed
 * cannot assume the layout's CSS variables, its fonts, or its theme attribute
 * exist, and a broken error page is the one failure with nowhere left to fall.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[wishit] root layout error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#0b0b0b',
          color: '#f2f2f2',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#f0806a',
            }}
          >
            Wishit
          </p>
          <h1 style={{ margin: '0.5rem 0 0', fontSize: '28px', lineHeight: 1.1 }}>
            The app failed to start.
          </h1>
          <p style={{ margin: '0.75rem 0 0', fontSize: '15px', color: '#b9b9b9' }}>
            This is not something you did, and none of your data is affected.
            Reloading usually clears it.
          </p>
          {error.digest && (
            <p style={{ margin: '1rem 0 0', fontSize: '12px', color: '#8a8a8a' }}>
              Reference <code style={{ color: '#f2f2f2' }}>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.6rem 1.1rem',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#12140f',
              background: '#c8f04a',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
