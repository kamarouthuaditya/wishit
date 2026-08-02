import { notFound } from 'next/navigation';
import { loadReadySnapshot } from '@/lib/db/repository';
import { toEngineInput, toPurchasePlan } from '@/lib/model/to-engine';
import { compareModes, evaluatePurchase } from '@/lib/engine';
import { saveWishlistItem } from '@/lib/actions';
import { inr, monthLabel } from '@/lib/format';
import { ModeComparison } from '@/components/impact-view';
import { WishlistRail } from '@/components/wishlist-rail';
import { WishlistAdd } from '@/components/wishlist-add';
import { WishlistItemForm } from '@/components/wishlist-item-form';
import type { Confidence } from '@/lib/engine';

export const dynamic = 'force-dynamic';

/**
 * The Decide route: the ten-minute session spent on one purchase, with the
 * rest of the wishlist a click away in the rail beside it. Everything here
 * answers the same question — if I buy this, what does it cost me in time —
 * before it answers anything else.
 */
export default async function WishlistItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = await loadReadySnapshot();
  const item = snapshot.wishlist.find((w) => w.id === id);
  if (!item) notFound();

  const { input, anchor } = toEngineInput(snapshot);
  const plan = toPurchasePlan(item, anchor);
  /*
   * A committed item is already inside `input.purchases` — see
   * `toEngineInput`. Evaluating it as a candidate on top of a baseline that
   * already includes it would count the same purchase twice and report a
   * delay that is not real, so it comes back out of the baseline here and
   * goes back in only as the one candidate being measured. This is the true
   * marginal impact whatever the item's current status is.
   */
  const baselineInput = {
    ...input,
    purchases: (input.purchases ?? []).filter((p) => p.id !== item.id),
  };
  const impact = evaluatePurchase(baselineInput, [plan]);
  const modes = compareModes(baselineInput, plan, {
    tenure: item.emi_tenure ?? 6,
    ratePct: item.is_no_cost ? 0 : Number(item.annual_rate_pct),
  });

  const short = (offset: number) => {
    const label = monthLabel(offset, anchor);
    return `${label.slice(0, 3)} ${label.slice(-2)}`;
  };

  const modeLabel =
    item.purchase_mode === 'cash'
      ? 'paid in full'
      : item.purchase_mode === 'emi'
        ? `${item.emi_tenure ?? 0}-month${item.is_no_cost ? ' no-cost' : ''} EMI`
        : item.purchase_mode === 'down-payment-emi'
          ? `${inr(Number(item.down_payment ?? 0), { compact: true })} down, then EMI`
          : `saving ${inr(Number(item.monthly_saving ?? 0), { compact: true })}/mo`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6 pb-6">
        <div>
          <h1 className="font-display text-[30px] leading-none">Decide</h1>
          <p className="mt-2 max-w-prose text-[15px] text-ink-soft">
            The purchase in front of you, and what it actually costs.
          </p>
        </div>
        <WishlistAdd />
      </div>

      <div className="grid border-t border-line lg:grid-cols-[340px_minmax(0,1fr)]">
        <WishlistRail items={snapshot.wishlist} input={input} anchor={anchor} selectedId={id} />

        <div className="min-w-0 py-8 lg:pl-9">
          {/* 1. The answer first. */}
          <div className="grid gap-10 border-b border-line pb-[30px] lg:grid-cols-2">
            <div className="max-w-[640px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {item.name} · {inr(Number(item.price))} · {modeLabel}
              </p>
              <p className="font-display mt-3 text-[46px] leading-[1.1] sm:text-[66px]">
                {heroSentence(impact.headlineDelay)}
              </p>
              <p className="mt-[18px] max-w-[58ch] text-[15px] leading-relaxed text-ink-soft text-justify">
                {heroParagraph(impact.headlineDelay, short)}
              </p>
            </div>

            <div className="border border-line px-[22px] py-[18px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Confidence
              </p>
              <p className={`font-display mt-1 text-[30px] leading-none ${confidenceColour(impact.confidence.level)}`}>
                {confidenceWord(impact.confidence.level)}
              </p>
              <p className="mt-1.5 mb-[14px] text-[12px] leading-snug text-ink-faint">
                {inr(impact.confidence.worstBuffer)} buffer on the worst month
                {impact.confidence.bufferPct >= 0 &&
                  ` — ${(impact.confidence.bufferPct * 100).toFixed(1)}%`}
                .
              </p>
              <div className="border-t border-line pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Earliest safe date
                </p>
                <p className="tnum mt-[2px] text-[22px]">
                  {impact.earliestSafeDelay == null
                    ? 'Not within two years'
                    : impact.earliestSafeDelay === 0
                      ? 'Today'
                      : short(impact.earliestSafeDelay)}
                </p>
                {impact.earliestSafeDelay != null && (
                  <p className="text-[12px] text-ink-faint">
                    Nothing goes red if you wait that long.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. What moves. */}
          {impact.goalDelays.length > 0 && (
            <div className="border-b border-line py-[26px]">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
                  What moves
                </h2>
                <span className="flex items-center gap-[18px] text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                  <span className="inline-flex items-center gap-[6px]">
                    <span aria-hidden className="inline-block h-2 w-3.5 bg-accent-600" />
                    As planned
                  </span>
                  <span className="inline-flex items-center gap-[6px]">
                    <span aria-hidden className="inline-block h-2 w-3.5 bg-accent-300" />
                    Added by this purchase
                  </span>
                </span>
              </div>

              <ul className="mt-[18px] flex flex-col">
                {impact.goalDelays.map((goal) => (
                  <GoalShiftRow key={goal.goalId} goal={goal} anchor={anchor} short={short} />
                ))}
              </ul>
            </div>
          )}

          {/* 3. Checkpoints. */}
          <div className="border-b border-line py-[26px]">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
              Checkpoints
            </h2>
            <p className="mt-1.5 text-[12px] text-ink-faint">
              Balance left at each mark, with the purchase in.
            </p>
            <div className="mt-4 grid grid-cols-2 divide-x divide-y divide-line border border-line sm:grid-cols-4 sm:divide-y-0">
              {impact.checkpoints.map((row) => (
                <div key={row.month} className="px-3 py-[14px]">
                  <div className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                    {row.month} mo
                  </div>
                  <div
                    className={`tnum mt-[3px] text-[18px] ${
                      row.scenarioCorpus < 0 ? 'text-bad' : 'text-ink'
                    }`}
                  >
                    {inr(row.scenarioCorpus, { compact: true })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How you pay it. */}
          <div className="py-[26px]">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
              How you pay it
            </h2>
            <p className="mt-1.5 text-[12px] text-ink-faint">
              Same item, every way. The selected row is what the figures above describe.
            </p>
            <div className="mt-4">
              <ModeComparison rows={modes} selectedMode={item.purchase_mode} />
            </div>
          </div>

          {/* 4. Action bar. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink pt-8">
            <StatusForm item={item} status="committed">
              <button
                type="submit"
                className="cursor-pointer border border-accent px-4 py-2 text-[14px] font-bold uppercase tracking-[0.06em] text-accent"
              >
                Commit this purchase
              </button>
            </StatusForm>

            {impact.earliestSafeDelay != null && impact.earliestSafeDelay > 0 && (
              <TargetDateForm item={item} monthOffset={impact.earliestSafeDelay}>
                <button
                  type="submit"
                  className="cursor-pointer border border-line-strong px-4 py-2 text-[14px] font-medium uppercase tracking-[0.06em] text-ink"
                >
                  Wait until {short(impact.earliestSafeDelay)}
                </button>
              </TargetDateForm>
            )}

            <span className="text-[13px] text-ink-faint">
              Committing adds it to the plan. Nothing is deleted — you can uncommit from the
              form below.
            </span>
          </div>

          <details className="mt-6 border-t border-line pt-4">
            <summary className="cursor-pointer list-none text-[13px] uppercase tracking-[0.06em] text-ink-faint hover:text-accent">
              Edit the details
              <span className="ml-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <div className="mt-4">
              <WishlistItemForm item={item} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function confidenceWord(level: Confidence): string {
  return level === 'high' ? 'Comfortable' : level === 'medium' ? 'A bit tight' : 'Low';
}

function confidenceColour(level: Confidence): string {
  return level === 'high' ? 'text-good' : level === 'medium' ? 'text-warn' : 'text-bad';
}

function heroSentence(
  delay: { name: string; delayMonths: number | null } | null,
): string {
  if (!delay || delay.delayMonths == null) return 'Nothing moves.';
  if (delay.delayMonths < 0.05) return 'No delay at all.';
  const totalDays = Math.round(delay.delayMonths * 30);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const parts: string[] = [];
  if (months > 0) parts.push(`${wordNumber(months)} month${months === 1 ? '' : 's'}`);
  if (days > 0) parts.push(`${wordNumber(days)} day${days === 1 ? '' : 's'}`);
  return `${parts.join(' and ')}.`;
}

function heroParagraph(
  delay: { name: string; baselineMonth: number | null; scenarioMonth: number | null; delayMonths: number | null } | null,
  short: (offset: number) => string,
): string {
  if (!delay) return 'This does not push back anything you are saving for.';
  if (delay.delayMonths == null) {
    return `You would not finish saving for your ${delay.name} either way — this purchase does not change that.`;
  }
  if (delay.delayMonths < 0.05) {
    return `Your ${delay.name} still lands on schedule. Nothing you are saving for moves.`;
  }
  return `That is how much later your ${delay.name} lands: ${short(delay.scenarioMonth!)} instead of ${short(delay.baselineMonth!)}.`;
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty'];

/** Small integers as words, capped at what a delay in months or days needs. */
function wordNumber(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
}

function GoalShiftRow({
  goal,
  anchor,
  short,
}: {
  goal: {
    goalId: string;
    name: string;
    baselineMonth: number | null;
    scenarioMonth: number | null;
    delayMonths: number | null;
  };
  anchor: Date;
  short: (offset: number) => string;
}) {
  const max = Math.max(goal.baselineMonth ?? 0, goal.scenarioMonth ?? 0, 1);
  const plannedPct = goal.baselineMonth != null ? (goal.baselineMonth / max) * 100 : 0;
  const addedPct =
    goal.scenarioMonth != null && goal.baselineMonth != null
      ? ((goal.scenarioMonth - goal.baselineMonth) / max) * 100
      : 0;

  return (
    <li className="grid grid-cols-[1fr] gap-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[170px_1fr_150px] sm:items-center sm:gap-5">
      <span className="text-[15px]">{goal.name}</span>
      <span className="flex h-3 w-full" role="presentation">
        <span className="h-full bg-accent-600" style={{ width: `${plannedPct}%` }} />
        <span className="h-full bg-accent-300" style={{ width: `${addedPct}%` }} />
      </span>
      <span className="tnum text-right text-[13px] text-ink-soft">
        {goal.baselineMonth == null ? '—' : short(goal.baselineMonth)}
        {' → '}
        <span className={goal.delayMonths && goal.delayMonths >= 0.05 ? 'text-warn' : ''}>
          {goal.scenarioMonth == null ? '—' : short(goal.scenarioMonth)}
        </span>
      </span>
    </li>
  );
}

/**
 * Preserves every field on the item, because `saveWishlistItem` is a full
 * save, not a patch — see the note beside it in `lib/actions.ts`. The action
 * buttons here submit the item exactly as it stands, with one field changed.
 */
function StatusForm({
  item,
  status,
  children,
}: {
  item: Awaited<ReturnType<typeof loadReadySnapshot>>['wishlist'][number];
  status: string;
  children: React.ReactNode;
}) {
  return (
    <form action={saveWishlistItem}>
      <HiddenFields item={item} />
      <input type="hidden" name="status" value={status} />
      {children}
    </form>
  );
}

function TargetDateForm({
  item,
  monthOffset,
  children,
}: {
  item: Awaited<ReturnType<typeof loadReadySnapshot>>['wishlist'][number];
  monthOffset: number;
  children: React.ReactNode;
}) {
  const date = new Date();
  date.setMonth(date.getMonth() + Math.round(monthOffset));
  return (
    <form action={saveWishlistItem}>
      <HiddenFields item={item} />
      <input type="hidden" name="target_date" value={date.toISOString().slice(0, 10)} />
      {children}
    </form>
  );
}

function HiddenFields({
  item,
}: {
  item: Awaited<ReturnType<typeof loadReadySnapshot>>['wishlist'][number];
}) {
  return (
    <>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="name" value={item.name} />
      <input type="hidden" name="category" value={item.category} />
      <input type="hidden" name="price" value={item.price} />
      <input type="hidden" name="priority" value={item.priority} />
      <input type="hidden" name="purchase_mode" value={item.purchase_mode} />
      <input type="hidden" name="annual_rate_pct" value={item.annual_rate_pct} />
      {item.target_date && (
        <input type="hidden" name="target_date" value={item.target_date} />
      )}
      {item.emi_amount != null && (
        <input type="hidden" name="emi_amount" value={item.emi_amount} />
      )}
      {item.emi_tenure != null && (
        <input type="hidden" name="emi_tenure" value={item.emi_tenure} />
      )}
      {item.down_payment != null && (
        <input type="hidden" name="down_payment" value={item.down_payment} />
      )}
      {item.monthly_saving != null && (
        <input type="hidden" name="monthly_saving" value={item.monthly_saving} />
      )}
      {item.is_no_cost && <input type="hidden" name="is_no_cost" value="on" />}
      {item.reason && <input type="hidden" name="reason" value={item.reason} />}
      {item.purchase_month != null && (
        <input type="hidden" name="purchase_month" value={item.purchase_month} />
      )}
    </>
  );
}

