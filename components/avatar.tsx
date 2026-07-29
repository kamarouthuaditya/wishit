import Link from 'next/link';

/**
 * Initials in a circle, linking to the account.
 *
 * The one curve in the product. Everything else is square by rule, and an
 * avatar is the single place where the round shape carries meaning rather than
 * decoration: it reads as "you" at a glance, in a corner where a square would
 * read as another button.
 */
export function Avatar({
  name,
  email,
  href = '/account',
}: {
  name?: string | null;
  email?: string | null;
  href?: string;
}) {
  const label = name?.trim() || email?.split('@')[0] || 'Account';

  return (
    <Link
      href={href}
      aria-label={`Account: ${label}`}
      title={label}
      style={{ borderRadius: '9999px' }}
      className="inline-flex size-8 items-center justify-center border border-line-strong bg-forest text-[11px] font-bold uppercase tracking-[0.04em] text-ink transition-colors duration-[140ms] hover:border-accent hover:text-accent"
    >
      {initials(label)}
    </Link>
  );
}

/** "Aditya Kamarouthu" → AK. One letter when there is only one word. */
export function initials(label: string): string {
  const words = label.trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words.at(-1)![0]).toUpperCase();
}
