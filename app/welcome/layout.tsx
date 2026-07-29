import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { stepsDone } from '@/lib/onboarding';
import { OnboardingRail } from '@/components/onboarding-rail';

export const dynamic = 'force-dynamic';

/**
 * The onboarding shell. One column of questions, one rail saying where you are.
 *
 * The app chrome — nav, balance strip, quick-log — is hidden for the whole of
 * this route by the root layout, which keys off `setup_complete`. A header full
 * of links to pages that bounce you straight back here is not navigation.
 */
export default async function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const snapshot = await loadSnapshot();
  // Finished once, finished for good: the sequence is not a place you return to.
  if (snapshot.profile.setup_complete) redirect('/');

  return (
    <div className="mx-auto max-w-3xl">
      <OnboardingRail done={stepsDone(snapshot.profile)} />
      <div className="mt-8 min-w-0 md:mt-10">{children}</div>
    </div>
  );
}
