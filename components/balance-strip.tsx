import { loadSnapshot } from '@/lib/db/repository';
import { monthlyBalance, type MonthlyBalance } from '@/lib/model/balance';
import { inr } from '@/lib/format';
import { toneText, type Tone } from '@/components/ui';
import type { Snapshot } from '@/lib/db/types';

/**
 * The running balance, pinned under the nav on every page.
 *
 * Whatever you are editing — an expense, a SIP, a goal, a loan — the question
 * behind it is the same: what is left after all of it. Keeping the figure in
 * the chrome means you never have to go back to the dashboard to check.
 */

export function balanceTone(balance: MonthlyBalance): Tone {
  if (balance.balance < 0) return 'bad';
  // Under a twentieth of income left over is technically fine and practically
  // not — one unplanned bill and it is gone.
  if (balance.income > 0 && balance.balance < balance.income * 0.05) return 'warn';
  return 'good';
}

export async function BalanceStrip({
  snapshot,
}: {
  /** Passed down when the caller has already read it; loaded here if not. */
  snapshot?: Snapshot | null;
}) {
  const loaded = snapshot ?? (await loadSnapshot());
  if (!loaded?.profile.setup_complete) return null;

  const balance = monthlyBalance(loaded);
  const tone = balanceTone(balance);

  return (
    <div className="border-t border-line bg-surface/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-5 gap-y-1 px-5 py-2 text-[13px]">
        {/* The workings, hidden on phones where only the answer fits. */}
        <span className="hidden flex-wrap items-baseline gap-x-2 text-ink-faint sm:flex">
          <Term label="Income" value={balance.income} />
          <span>−</span>
          <Term label="Expenses" value={balance.expenses} />
          {balance.loanEmis > 0 && (
            <>
              <span>−</span>
              <Term label="EMIs" value={balance.loanEmis} />
            </>
          )}
          <span>−</span>
          <Term label="Savings & goals" value={balance.savings} />
          {balance.wishlist > 0 && (
            <>
              <span>−</span>
              <Term label="Wishlist" value={balance.wishlist} />
            </>
          )}
        </span>

        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">
            Balance left
          </span>
          <strong className={`tnum text-[15px] font-semibold ${toneText(tone)}`}>
            {inr(balance.balance)}
          </strong>
          <span className="text-[12px] text-ink-faint">/month</span>
        </span>
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label} <span className="tnum text-ink-soft">{inr(value)}</span>
    </span>
  );
}

/**
 * A hairline and a coloured figure, not a coloured block. Filling a panel with
 * red because the balance is negative shouts at someone who already knows.
 */
const CALLOUT_TONE: Record<Tone, string> = {
  good: 'border-t-good',
  warn: 'border-t-warn',
  bad: 'border-t-bad',
  accent: 'border-t-accent',
  neutral: 'border-t-line-strong',
};

/**
 * The same figure, spelled out in the page body where the editing happens.
 * Takes the balance as a prop so a page that has already loaded the snapshot
 * does not load it a second time.
 */
export function BalanceCallout({
  balance,
  note,
}: {
  balance: MonthlyBalance;
  note?: string;
}) {
  const tone = balanceTone(balance);
  return (
    <div
      className={`border border-line border-t-2 bg-surface px-5 py-4 ${CALLOUT_TONE[tone]}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-ink-soft">
          <Term label="Income" value={balance.income} />
          <span className="text-ink-faint">−</span>
          <Term label="Expenses" value={balance.expenses} />
          {balance.loanEmis > 0 && (
            <>
              <span className="text-ink-faint">−</span>
              <Term label="EMIs" value={balance.loanEmis} />
            </>
          )}
          <span className="text-ink-faint">−</span>
          <Term label="Savings & goals" value={balance.savings} />
          {balance.wishlist > 0 && (
            <>
              <span className="text-ink-faint">−</span>
              <Term label="Wishlist" value={balance.wishlist} />
            </>
          )}
        </div>
        <div className="text-right">
          <div className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">
            Balance left
          </div>
          <div className={`tnum text-2xl font-semibold ${toneText(tone)}`}>
            {inr(balance.balance)}
          </div>
        </div>
      </div>
      {balance.notYetStarted > 0 && (
        <p className="mt-2 text-[13px] text-ink-faint">
          {inr(balance.notYetStarted)} a month of budget lines start later and are
          not counted yet.
        </p>
      )}
      {note && <p className="mt-2 text-[13px] text-ink-soft">{note}</p>}
    </div>
  );
}
