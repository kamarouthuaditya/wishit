import { assessContribution, type ContributionCheck } from '@/lib/engine';
import { inr } from '@/lib/format';
import { Money } from '@/components/ui';

/**
 * Says whether what a goal is being fed is actually the right amount, and by
 * how much it is off. Money in is only half the question.
 */
export function ContributionNote({
  target,
  current,
  funding,
  deadlineMonths,
  returnPct = 0,
  compact,
}: {
  target: number;
  current: number;
  funding: number;
  deadlineMonths: number | null;
  returnPct?: number;
  /** One line, for dense lists. */
  compact?: boolean;
}) {
  const check = assessContribution({
    target,
    current,
    funding,
    deadlineMonths,
    annualReturnPct: returnPct,
  });

  const tone = toneFor(check);
  const message = messageFor(check);
  if (!message) return null;

  if (compact) {
    return <span className={`text-[13px] ${tone.text}`}>{message}</span>;
  }

  return (
    <p className={`mt-3 rounded-xl px-4 py-3 text-[15px] ${tone.box}`}>
      {message}
    </p>
  );
}

function toneFor(check: ContributionCheck) {
  switch (check.status) {
    case 'complete':
    case 'on-track':
      return { text: 'text-good', box: 'bg-good-soft text-good' };
    case 'short':
    case 'unfunded':
      return { text: 'text-warn', box: 'bg-warn-soft text-warn' };
    default:
      return { text: 'text-ink-soft', box: 'bg-surface-lift text-ink-soft' };
  }
}

function messageFor(check: ContributionCheck): string | null {
  const from = 'You are putting in';
  const late = check.monthsVsDeadline;

  switch (check.status) {
    case 'complete':
      return 'Target already reached.';

    case 'unfunded':
      return check.required != null
        ? `Nothing is going in yet. It needs ${inr(check.required)} a month to land on time.`
        : 'Nothing is going in yet.';

    case 'no-deadline':
      return check.monthsAtFunding == null
        ? `${from} nothing, so this never completes. Set an amount or a target date.`
        : `${from} ${inr(check.funding)} a month — on target in about ${Math.ceil(check.monthsAtFunding)} months. No target date set.`;

    case 'on-track':
      return `${from} ${inr(check.funding)} a month, which is exactly what this needs.`;

    case 'short': {
      const gap = inr(Math.abs(check.difference ?? 0));
      const needed = inr(check.required ?? 0);
      if (check.monthsAtFunding == null) {
        return `${from} ${inr(check.funding)} a month — not enough to ever reach the target. It needs ${needed}.`;
      }
      return `${from} ${inr(check.funding)} a month, ${gap} short of the ${needed} this needs. At this rate it lands about ${fmtMonths(late)} late.`;
    }

    case 'ahead': {
      const spare = inr(Math.abs(check.difference ?? 0));
      const needed = inr(check.required ?? 0);
      return `${from} ${inr(check.funding)} a month — ${spare} more than the ${needed} needed. It lands about ${fmtMonths(late == null ? null : -late)} early, so you could free up ${spare} a month for something else.`;
    }
  }
}

function fmtMonths(months: number | null): string {
  if (months == null) return 'some time';
  const rounded = Math.abs(months);
  if (rounded < 1) return 'a few weeks';
  return `${rounded.toFixed(rounded < 10 ? 1 : 0)} months`;
}

/** Inline variant used in dense rows. */
export function ContributionSummary(props: {
  target: number;
  current: number;
  funding: number;
  deadlineMonths: number | null;
  returnPct?: number;
}) {
  const check = assessContribution({
    target: props.target,
    current: props.current,
    funding: props.funding,
    deadlineMonths: props.deadlineMonths,
    annualReturnPct: props.returnPct ?? 0,
  });

  if (check.status === 'complete') {
    return <span className="text-[13px] text-good">target reached</span>;
  }
  if (check.required == null) {
    return (
      <span className="text-[13px] text-ink-faint">
        {check.monthsAtFunding == null
          ? 'no target date'
          : `about ${Math.ceil(check.monthsAtFunding)} months`}
      </span>
    );
  }

  const tone =
    check.status === 'on-track'
      ? 'text-good'
      : check.status === 'ahead'
        ? 'text-ink-soft'
        : 'text-warn';

  return (
    <span className={`text-[13px] ${tone}`}>
      needs <Money amount={check.required} />
      {check.status !== 'on-track' && (
        <>
          {' · '}
          {check.status === 'short' ? 'short by ' : 'over by '}
          <Money amount={Math.abs(check.difference ?? 0)} />
        </>
      )}
    </span>
  );
}
