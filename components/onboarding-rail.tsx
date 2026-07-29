'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ONBOARDING_STEPS, ONBOARDING_ROOT } from '@/lib/onboarding';
import { IconCheck } from '@/components/icons';

/**
 * Where you are in the sequence, and how much is left.
 *
 * A client component only because it reads the current path: the layout knows
 * how many steps are finished, but not which one is on screen, and passing the
 * slug down through every page would mean six chances to pass the wrong one.
 *
 * Finished steps are links. Unreached ones are not, and do not pretend to be —
 * a rail of six clickable steps where four silently bounce you back is worse
 * than a rail that shows the sequence honestly.
 */
export function OnboardingRail({ done }: { done: number }) {
  const pathname = usePathname();
  const current = ONBOARDING_STEPS.findIndex(
    (step) => pathname === `${ONBOARDING_ROOT}/${step.slug}`,
  );
  const index = current === -1 ? Math.min(done, ONBOARDING_STEPS.length - 1) : current;

  return (
    <nav aria-label="Setup progress">
      {/* Phone: the position, not the map. Six rows of text to scroll past
          before the question is not a progress indicator, it is an obstacle. */}
      <div className="md:hidden">
        <p className="eyebrow flex items-baseline justify-between gap-3">
          <span>
            Step {index + 1} of {ONBOARDING_STEPS.length}
          </span>
          <span className="text-ink-faint normal-case tracking-normal">
            {ONBOARDING_STEPS[index].title}
          </span>
        </p>
        <ol className="mt-2 flex gap-1" aria-hidden>
          {ONBOARDING_STEPS.map((step, i) => (
            <li
              key={step.slug}
              className={`h-1 flex-1 ${
                i < index ? 'bg-accent/45' : i === index ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </ol>
      </div>

      {/*
        The rule along the top is the progress bar and the divider at once: lime
        behind what is done, hairline in front of what is not. Six boxed steps
        would be six more borders on a screen whose whole job is one question.
      */}
      <ol className="hidden gap-4 md:grid md:grid-cols-6">
        {ONBOARDING_STEPS.map((step, i) => {
          const finished = i < done;
          const here = i === index;
          const reachable = i <= done && !here;

          const body = (
            <span className="block pt-2.5">
              <span
                className={`tnum flex h-3.5 items-center text-[11px] ${
                  here ? 'text-accent' : finished ? 'text-ink-faint' : 'text-ink-faint/50'
                }`}
              >
                {finished ? <IconCheck size={12} /> : String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={`mt-1 block text-[12px] leading-snug ${
                  here
                    ? 'font-semibold text-ink'
                    : finished
                      ? 'text-ink-soft'
                      : 'text-ink-faint/60'
                }`}
              >
                {step.title}
              </span>
              {here && !step.required && (
                <span className="mt-0.5 block text-[11px] text-ink-faint/70">
                  optional
                </span>
              )}
            </span>
          );

          return (
            <li
              key={step.slug}
              className={`border-t-2 ${
                here
                  ? 'border-t-accent'
                  : finished
                    ? 'border-t-accent/45'
                    : 'border-t-line'
              }`}
            >
              {reachable ? (
                <Link
                  href={`${ONBOARDING_ROOT}/${step.slug}`}
                  className="block transition-colors duration-[140ms] hover:text-accent"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
