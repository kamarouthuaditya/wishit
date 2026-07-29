import { loadReadySnapshot } from '@/lib/db/repository';
import { SetupForm } from '@/components/setup-form';
import { PageGuide } from '@/components/page-guide';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const snapshot = await loadReadySnapshot();

  return (
    <div className="max-w-3xl space-y-8">
      <header className="border-b border-line-strong pb-5">
        <div className="flex items-center gap-2.5">
          <p className="eyebrow">Settings</p>
          <PageGuide guide="setup" compact />
        </div>
        <h1 className="mt-2 font-display text-[32px] leading-none">
          The numbers everything else is built on
        </h1>
        <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
          Set this up once; everything is editable later. Expenses, loans and goals
          each have their own page.
        </p>
      </header>

      <SetupForm
        profile={snapshot.profile}
        salary={snapshot.income.find((i) => i.type === 'salary')}
        bonus={snapshot.income.find((i) => i.type === 'bonus')}
      />
    </div>
  );
}
