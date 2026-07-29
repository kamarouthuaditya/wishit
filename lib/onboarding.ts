import type { ProfileRow } from '@/lib/db/types';

/**
 * First run, as a sequence.
 *
 * One long form asked for eleven numbers before showing a single one back, and
 * the two that the app cannot work without — what comes in, what you have —
 * were buried among nine that have perfectly good defaults. The sequence puts
 * the mandatory pair first, then offers the three things that make the answer
 * *yours* (what the month costs, what you owe, what you are saving for), each
 * skippable, each showing the balance move as you type. Appearance is last
 * because it is the one step where getting it wrong costs nothing.
 *
 * Progress is a count of finished steps on the profile rather than a slug, so
 * reordering or renaming a step cannot strand someone half way through.
 */
export interface OnboardingStep {
  slug: string;
  /** Shown in the rail. Short — it sits in a 200px column. */
  title: string;
  /** Required steps cannot be skipped, and gate everything after them. */
  required: boolean;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { slug: 'income', title: 'What comes in', required: true },
  { slug: 'balances', title: 'What you have', required: true },
  { slug: 'expenses', title: 'What the month costs', required: false },
  { slug: 'commitments', title: 'What you owe', required: false },
  { slug: 'goals', title: 'What you are saving for', required: false },
  { slug: 'appearance', title: 'How it looks', required: false },
];

export const ONBOARDING_ROOT = '/welcome';

export type OnboardingSlug = (typeof ONBOARDING_STEPS)[number]['slug'];

export function stepIndex(slug: string): number {
  return ONBOARDING_STEPS.findIndex((s) => s.slug === slug);
}

export function stepPath(index: number): string {
  const clamped = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1));
  return `${ONBOARDING_ROOT}/${ONBOARDING_STEPS[clamped].slug}`;
}

/** Steps finished, clamped to the sequence — the stored counter can outrun it. */
export function stepsDone(profile: Pick<ProfileRow, 'onboarding_step'>): number {
  const raw = Number(profile.onboarding_step ?? 0);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(Math.trunc(raw), ONBOARDING_STEPS.length);
}

/** Where an interrupted sign-up picks up. */
export function resumePath(profile: Pick<ProfileRow, 'onboarding_step'>): string {
  return stepPath(stepsDone(profile));
}

/**
 * Where a request for `slug` should actually go.
 *
 * Back is always allowed — an answer you want to change is two clicks away, not
 * a restart. Forward is not: landing on the goals step with no salary entered
 * shows a page of dashes and no way to understand why.
 *
 * Returns null when the requested step is the right one to render.
 */
export function onboardingGuard(
  profile: Pick<ProfileRow, 'onboarding_step' | 'setup_complete'>,
  slug: string,
): string | null {
  if (profile.setup_complete) return '/';

  const index = stepIndex(slug);
  if (index === -1) return resumePath(profile);

  const done = stepsDone(profile);
  return index > done ? stepPath(done) : null;
}

/**
 * The counter after finishing `slug`. Monotonic: revisiting step 1 to fix a
 * typo must not throw away the four steps done after it.
 */
export function advancedStep(
  profile: Pick<ProfileRow, 'onboarding_step'>,
  slug: string,
): number {
  const index = stepIndex(slug);
  if (index === -1) return stepsDone(profile);
  return Math.max(stepsDone(profile), index + 1);
}

/** The step after `slug`, or null when `slug` is the last one. */
export function nextStep(slug: string): OnboardingStep | null {
  const index = stepIndex(slug);
  if (index === -1) return null;
  return ONBOARDING_STEPS[index + 1] ?? null;
}

export function previousStep(slug: string): OnboardingStep | null {
  const index = stepIndex(slug);
  if (index <= 0) return null;
  return ONBOARDING_STEPS[index - 1];
}
