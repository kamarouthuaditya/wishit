import type { ImpactResult, ModeComparisonRow } from '@/lib/engine';
import { inr, monthLabel, pct } from '@/lib/format';
import { Card, Money, Pill, TrafficLight } from '@/components/ui';

/**
 * Money -> time. The translation people actually feel, and the reason this app
 * exists. Everything else on the page supports this one line.
 */
export function ImpactHeadline({
  impact,
  anchor,
  title,
}: {
  impact: ImpactResult;
  anchor: Date;
  title: string;
}) {
  const hasRed = impact.newBreaches.some((b) => b.severity === 'red');
  const delay = impact.headlineDelay;
  const delayed = (delay?.delayMonths ?? 0) >= 0.05;
  const tone = hasRed ? 'bad' : delayed || impact.newBreaches.length > 0 ? 'warn' : 'good';

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-2">
          <TrafficLight tone={tone} />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold uppercase tracking-wide text-ink-soft">
            {title}
          </h2>
          <p className="mt-2 max-w-prose text-2xl font-semibold leading-snug tracking-tight">
            {delay == null || delay.delayMonths == null ? (
              'This does not push back anything you are saving for.'
            ) : delay.delayMonths < 0.05 ? (
              <>
                Your <em>{delay.name}</em> still arrives on time.
              </>
            ) : (
              <>
                You wait{' '}
                <span className="tnum">{delay.delayMonths.toFixed(1)} months</span> longer
                for your <em>{delay.name}</em> — {monthLabel(delay.scenarioMonth!, anchor)}{' '}
                instead of {monthLabel(delay.baselineMonth!, anchor)}.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-ink-soft">
            <span>
              Total cost <Money amount={impact.totalCost} className="font-semibold" />
            </span>
            <span>
              <Pill
                tone={
                  impact.confidence.level === 'high'
                    ? 'good'
                    : impact.confidence.level === 'medium'
                      ? 'warn'
                      : 'bad'
                }
              >
                {impact.confidence.level === 'high'
                  ? 'comfortable'
                  : impact.confidence.level === 'medium'
                    ? 'a bit tight'
                    : 'very tight'}
              </Pill>
            </span>
            <span className="text-[14px] text-ink-faint">
              Tightest month leaves {inr(impact.confidence.worstBuffer)} spare —{' '}
              {pct(impact.confidence.bufferPct, 0)} of that month’s surplus.
            </span>
          </div>

          {impact.earliestSafeDelay != null && impact.earliestSafeDelay > 0 && (
            <p className="mt-4 rounded-xl bg-surface-lift px-4 py-3 text-[15px]">
              Wait until{' '}
              <strong>{monthLabel(impact.earliestSafeDelay + 1, anchor)}</strong> —{' '}
              {impact.earliestSafeDelay} month
              {impact.earliestSafeDelay === 1 ? '' : 's'} from now — and this costs you
              nothing.
            </p>
          )}
          {impact.earliestSafeDelay == null && (
            <p className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-[15px] text-bad">
              Waiting does not fix this, even two years out. It needs a different
              payment method or a smaller amount.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function BreachList({
  impact,
  anchor,
}: {
  impact: ImpactResult;
  anchor: Date;
}) {
  if (impact.newBreaches.length === 0) {
    return (
      <Card title="Warnings">
        <p className="text-[15px] text-good">
          None. Your savings stay above the emergency floor, your surplus never goes
          negative, and no goal slips past its target date.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Warnings" hint="Problems this purchase would introduce">
      <ul className="space-y-2.5">
        {impact.newBreaches.map((breach, i) => (
          <li key={`${breach.kind}-${i}`} className="flex items-start gap-2.5">
            <span className="mt-1.5">
              <TrafficLight tone={breach.severity === 'red' ? 'bad' : 'warn'} />
            </span>
            <span className="text-[15px] text-ink-soft">
              {breach.message}{' '}
              <span className="text-ink-faint">({monthLabel(breach.month, anchor)})</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CheckpointTable({
  impact,
  anchor,
}: {
  impact: ImpactResult;
  anchor: Date;
}) {
  const goalNames = impact.checkpoints[0]?.goals.map((g) => g.name) ?? [];

  return (
    <Card
      title="Projected savings"
      hint="Baseline against this purchase, at each checkpoint"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-[13px] uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-4 font-medium">Month</th>
              <th className="py-2 pr-4 text-right font-medium">Without</th>
              <th className="py-2 pr-4 text-right font-medium">With</th>
              <th className="py-2 pr-4 text-right font-medium">Delta</th>
              {goalNames.map((name) => (
                <th key={name} className="py-2 pr-4 text-right font-medium">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {impact.checkpoints.map((row) => (
              <tr key={row.month}>
                <td className="py-2 pr-4 text-ink-soft">
                  {monthLabel(row.month, anchor)}
                </td>
                <td className="py-2 pr-4 text-right">
                  <Money amount={row.baselineCorpus} compact />
                </td>
                <td className="py-2 pr-4 text-right">
                  <Money amount={row.scenarioCorpus} compact />
                </td>
                <td className="py-2 pr-4 text-right">
                  <Money
                    amount={row.corpusDelta}
                    tone={row.corpusDelta < 0 ? 'bad' : 'good'}
                    compact
                  />
                </td>
                {row.goals.map((goal) => (
                  <td key={goal.goalId} className="py-2 pr-4 text-right text-ink-soft">
                    <Money amount={goal.scenarioBalance} compact />
                    {Math.abs(goal.delta) >= 1 && (
                      <span className="ml-1 text-[13px] text-bad">
                        ({inr(goal.delta, { compact: true })})
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function GoalDelayTable({ impact }: { impact: ImpactResult }) {
  if (impact.goalDelays.length === 0) return null;
  return (
    <Card title="Goal impact">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-[13px] uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-4 font-medium">Goal</th>
              <th className="py-2 pr-4 text-right font-medium">Baseline</th>
              <th className="py-2 pr-4 text-right font-medium">With purchase</th>
              <th className="py-2 text-right font-medium">Delay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {impact.goalDelays.map((goal) => (
              <tr key={goal.goalId}>
                <td className="py-2 pr-4">
                  {goal.name}
                  {goal.newlyMissesDeadline && (
                    <span className="ml-2">
                      <Pill tone="warn">now misses target</Pill>
                    </span>
                  )}
                </td>
                <td className="tnum py-2 pr-4 text-right text-ink-soft">
                  {goal.baselineMonth == null
                    ? '—'
                    : `${goal.baselineMonth.toFixed(1)} months`}
                </td>
                <td className="tnum py-2 pr-4 text-right">
                  {goal.scenarioMonth == null
                    ? '—'
                    : `${goal.scenarioMonth.toFixed(1)} months`}
                </td>
                <td
                  className={`tnum py-2 text-right ${
                    (goal.delayMonths ?? 0) >= 0.05 ? 'text-warn' : 'text-ink-soft'
                  }`}
                >
                  {goal.delayMonths == null
                    ? '—'
                    : goal.delayMonths < 0.05
                      ? 'none'
                      : `${goal.delayMonths.toFixed(1)} months`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Same item, four+ ways: the doc's plain hairline table (no card, no
 * shading beyond the selected row) carrying the full column set — total
 * cost, monthly outflow, goal delay, lowest balance, when it's owned, and a
 * feasibility verdict. The selected row (whichever mode the item is
 * actually set to) carries a 2px accent left edge and a lifted background,
 * the same treatment as a picked row in the rail beside it.
 */
export function ModeComparison({
  rows,
  selectedMode,
}: {
  rows: ModeComparisonRow[];
  selectedMode: ModeComparisonRow['mode'];
}) {
  const cheapest = Math.min(...rows.map((r) => r.totalPaid));
  const leastDelay = Math.min(
    ...rows.map((r) => r.goalDelayMonths ?? Number.POSITIVE_INFINITY),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className="py-[9px] text-left text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Method
            </th>
            <th className="py-[9px] text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Total cost
            </th>
            <th className="py-[9px] text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Per month
            </th>
            <th className="py-[9px] text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Goal delay
            </th>
            <th className="py-[9px] text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Lowest balance
            </th>
            <th className="py-[9px] text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Owned
            </th>
            <th className="py-[9px] text-right text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Verdict
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.mode === selectedMode;
            return (
              <tr
                key={row.mode}
                className={`border-b border-line ${selected ? 'bg-surface' : ''}`}
              >
                <td className={`py-[9px] ${selected ? 'border-l-2 border-l-accent pl-3' : ''}`}>
                  {row.label}
                </td>
                <td className="tnum py-[9px] text-right">
                  <Money
                    amount={row.totalPaid}
                    tone={row.totalPaid === cheapest ? 'good' : 'neutral'}
                  />
                </td>
                <td className="tnum py-[9px] text-right text-ink-soft">
                  {row.monthlyOutflow > 0 ? <Money amount={row.monthlyOutflow} /> : '—'}
                </td>
                <td
                  className={`tnum py-[9px] text-right ${
                    row.goalDelayMonths === leastDelay ? 'text-good' : ''
                  }`}
                >
                  {row.goalDelayMonths == null
                    ? '—'
                    : row.goalDelayMonths < 0.05
                      ? 'none'
                      : `${row.goalDelayMonths.toFixed(1)} mo`}
                </td>
                <td className="tnum py-[9px] text-right text-ink-soft">
                  <Money amount={row.lowestCorpus} compact />
                </td>
                <td className="tnum py-[9px] text-right text-ink-soft">
                  {row.ownedInMonth == null
                    ? 'never'
                    : row.ownedInMonth === 1
                      ? 'immediately'
                      : `month ${row.ownedInMonth}`}
                </td>
                <td className="py-[9px] text-right">
                  {row.feasible ? (
                    <Pill tone="good">safe</Pill>
                  ) : (
                    <Pill tone="bad">
                      {row.redBreaches} breach{row.redBreaches === 1 ? '' : 'es'}
                    </Pill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
