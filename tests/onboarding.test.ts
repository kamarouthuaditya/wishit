import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  advancedStep,
  nextStep,
  onboardingGuard,
  previousStep,
  resumePath,
  stepsDone,
} from '@/lib/onboarding';

const at = (onboarding_step: number, setup_complete = false) => ({
  onboarding_step,
  setup_complete,
});

describe('onboarding sequence', () => {
  it('starts a new account at the first step', () => {
    expect(resumePath(at(0))).toBe('/welcome/income');
  });

  it('resumes where an interrupted sign-up stopped', () => {
    expect(resumePath(at(2))).toBe('/welcome/expenses');
  });

  it('clamps a counter that has run past the end', () => {
    // Rows migrated from before the sequence existed carry 99.
    expect(stepsDone(at(99))).toBe(ONBOARDING_STEPS.length);
    expect(resumePath(at(99))).toBe(
      `/welcome/${ONBOARDING_STEPS.at(-1)!.slug}`,
    );
  });

  it('survives a missing or nonsense counter', () => {
    expect(stepsDone({ onboarding_step: undefined as unknown as number })).toBe(0);
    expect(stepsDone({ onboarding_step: -4 })).toBe(0);
    expect(stepsDone({ onboarding_step: 1.7 })).toBe(1);
  });
});

describe('onboardingGuard', () => {
  it('renders the step that is next', () => {
    expect(onboardingGuard(at(1), 'balances')).toBeNull();
  });

  it('lets you go back to a finished step', () => {
    expect(onboardingGuard(at(4), 'income')).toBeNull();
  });

  it('refuses to skip ahead, and says where to go instead', () => {
    expect(onboardingGuard(at(1), 'goals')).toBe('/welcome/balances');
  });

  it('sends a finished account to the dashboard', () => {
    expect(onboardingGuard(at(2, true), 'expenses')).toBe('/');
  });

  it('sends an unknown slug back to the resume point', () => {
    expect(onboardingGuard(at(3), 'nonsense')).toBe('/welcome/commitments');
  });
});

describe('advancedStep', () => {
  it('counts a step as finished', () => {
    expect(advancedStep(at(0), 'income')).toBe(1);
  });

  it('never goes backwards when an early step is edited', () => {
    // Fixing a typo in the salary on step 1 must not discard steps 2 to 5.
    expect(advancedStep(at(5), 'income')).toBe(5);
  });

  it('ignores a slug that is not in the sequence', () => {
    expect(advancedStep(at(3), 'nonsense')).toBe(3);
  });
});

describe('neighbours', () => {
  it('knows what comes next and before', () => {
    expect(nextStep('income')?.slug).toBe('balances');
    expect(previousStep('balances')?.slug).toBe('income');
  });

  it('has no step before the first or after the last', () => {
    expect(previousStep('income')).toBeNull();
    expect(nextStep(ONBOARDING_STEPS.at(-1)!.slug)).toBeNull();
  });

  it('asks for the two things the app cannot run without, first', () => {
    const required = ONBOARDING_STEPS.filter((s) => s.required).map((s) => s.slug);
    expect(required).toEqual(['income', 'balances']);
    expect(ONBOARDING_STEPS.slice(0, 2).every((s) => s.required)).toBe(true);
  });
});
