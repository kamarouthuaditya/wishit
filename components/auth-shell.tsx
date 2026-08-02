import type { ReactNode } from 'react';

/**
 * The auth pages used to be a single narrow column pinned to the top-left of
 * whatever viewport it was given — correct on a phone, and on a desktop
 * monitor just a form adrift in empty space. This breaks out of `<main>`'s
 * centred, padded column (the `-mx-[50vw]` pair is the standard full-bleed
 * trick: it cancels the ancestor's max-width regardless of what that width
 * is) and composes a real two-up layout above `md`: the brand panel carries
 * the illustration and the one-line pitch, the form sits in its own column
 * next to it rather than under it. Below `md` the brand panel simply isn't
 * rendered, and the form is exactly the single centred column it always was.
 */
export function AuthShell({
  art,
  tagline,
  children,
}: {
  art: ReactNode;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-5 md:px-6">
      <div className="mx-auto grid max-w-[1440px] items-stretch gap-6 py-4 md:grid-cols-2 md:py-8">
        <div className="relative hidden flex-col justify-center overflow-hidden border border-line bg-gradient-to-br from-accent-soft via-surface-lift to-surface p-12 md:flex">
          <div className="relative mx-auto w-full max-w-sm">
            {art}
            <p className="font-display mt-8 text-[28px] leading-[1.2] text-ink">
              {tagline}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center py-6 md:py-4">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
