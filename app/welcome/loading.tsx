/**
 * What a step looks like before its figures arrive.
 *
 * The Continue buttons say they are working now, but the back links are plain
 * navigations with nothing to hang a pending state on, and every step reads
 * nine tables from a database roughly 450ms away. Without this the old step
 * simply sat there, fully lit and no longer true, until the new one replaced it.
 *
 * Shaped like the step it stands in for — eyebrow, heading, a paragraph, the
 * balance panel — so the swap is a fill rather than a jump. No spinner: the
 * stylesheet flattens animation under `prefers-reduced-motion`, and a shape
 * that is already right says the same thing without moving.
 */
export default function WelcomeLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading this step…</span>

      <header>
        <Line className="h-3 w-16" />
        <Line className="mt-3 h-8 w-2/3" />
        <Line className="mt-4 h-3 w-full max-w-prose" />
        <Line className="mt-2 h-3 w-4/5 max-w-prose" />
      </header>

      <div className="border border-line bg-surface px-5 py-5">
        <Line className="h-2.5 w-40" />
        <Line className="mt-4 h-10 w-52" />
        <Line className="mt-4 h-3 w-2/3" />
      </div>

      <div className="border-t border-line pt-5">
        <Line className="h-9 w-36" />
      </div>
    </div>
  );
}

/** A block of nothing, at the weight of the hairlines around it. */
function Line({ className }: { className: string }) {
  return <div aria-hidden className={`bg-surface-lift ${className}`} />;
}
