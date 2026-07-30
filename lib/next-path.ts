/**
 * A path to come back to after signing in, and only ever a path.
 *
 * `next` arrives from a query string — the proxy puts it there when it bounces
 * a signed-out visitor — so without this it is an open redirect:
 * `/login?next=https://example.com` would hand somebody a Google consent screen
 * on our domain that lands them on theirs. A leading `//` is the same attack in
 * protocol-relative form, and a backslash is what some browsers normalise into
 * one.
 */
export function safeNext(value: FormDataEntryValue | string | null): string {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//') || path.startsWith('/\\')) return '/';
  return path;
}
