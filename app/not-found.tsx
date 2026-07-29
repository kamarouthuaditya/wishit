import Link from 'next/link';

/**
 * A mistyped URL, or a page for a row that has since been deleted — the second
 * is the one testers will hit, from a bookmarked wishlist item.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-[30px] leading-none">
        Nothing lives here.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Either the address is wrong, or whatever used to be at it has been
        deleted since you last looked.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center border border-line-strong px-4 py-2 text-[13px] font-medium uppercase tracking-[0.06em] text-ink transition-colors hover:border-accent hover:text-accent"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
