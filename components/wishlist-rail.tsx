import Link from 'next/link';
import { toPurchasePlan } from '@/lib/model/to-engine';
import { evaluatePurchase } from '@/lib/engine';
import { inr } from '@/lib/format';
import { Pill } from '@/components/ui';
import type { EngineInput } from '@/lib/engine/types';
import type { WishlistItemRow } from '@/lib/db/types';

const STATUS_TONE = {
  idea: 'neutral',
  planned: 'accent',
  committed: 'warn',
  purchased: 'good',
  dropped: 'neutral',
} as const;

const STATUS_LABEL = {
  idea: 'idea',
  planned: 'considering',
  committed: 'committed',
  purchased: 'purchased',
  dropped: 'dropped',
} as const;

/**
 * The left pane: every wishlist item, ranked by nothing in particular — the
 * rail is a list to scan, not a priority order, because the thing that ranks
 * them (how much each one costs you) is the reason the detail pane exists.
 *
 * The selected row carries a 2px accent left border; every row carries a
 * transparent one the same width, so selecting a row does not shift the text
 * beside it.
 */
export function WishlistRail({
  items,
  input,
  anchor,
  selectedId,
}: {
  items: WishlistItemRow[];
  input: EngineInput;
  anchor: Date;
  selectedId: string | null;
}) {
  const active = items.filter((w) => w.status !== 'purchased' && w.status !== 'dropped');
  const committed = active.filter((w) => w.status === 'committed');
  const archived = items.filter((w) => w.status === 'purchased' || w.status === 'dropped');

  return (
    <div className="lg:border-r lg:border-line">
      <div className="px-2 pb-3 pt-5 lg:px-9">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
          Wishlist
        </h2>
        <p className="mt-1.5 text-[12px] text-ink-faint">
          {active.length - committed.length} considering · {committed.length} committed
        </p>
      </div>

      <ul className="flex gap-px overflow-x-auto border-y border-line bg-line lg:block lg:divide-y lg:divide-line lg:overflow-visible lg:border-0 lg:border-t lg:bg-transparent">
        {[...active, ...archived].map((item) => {
          const gone = item.status === 'purchased' || item.status === 'dropped';
          // Committed items are already inside the baseline simulation (see
          // `toEngineInput`), so running them through `evaluatePurchase` again
          // would add a second copy of the same purchase on top of itself and
          // report a delay that does not exist. Only genuine candidates —
          // ideas and things still being considered — get a delay figure.
          const isCandidate = !gone && item.status !== 'committed';
          const delay = isCandidate ? delayFor(item, input, anchor) : null;
          const current = item.id === selectedId;
          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              <Link
                href={`/wishlist/${item.id}`}
                aria-current={current ? 'page' : undefined}
                className={`block min-w-[240px] border-l-2 px-5 py-[14px] transition-colors duration-[140ms] lg:min-w-0 lg:px-9 ${
                  current
                    ? 'border-l-accent bg-surface'
                    : 'border-l-transparent hover:bg-surface-lift'
                } ${gone ? 'opacity-60' : ''}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={`text-[15px] ${current ? 'text-ink' : 'text-ink-soft'} ${gone ? 'line-through' : ''}`}
                  >
                    {item.name}
                  </span>
                  <span
                    className={`tnum shrink-0 text-[14px] ${current ? 'text-ink' : 'text-ink-soft'}`}
                  >
                    {inr(Number(item.price), { compact: true })}
                  </span>
                </span>
                {gone ? (
                  <span className="mt-1.5 flex items-center gap-2">
                    <Pill tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Pill>
                    <span className="text-[12px] text-ink-faint">already in the plan</span>
                  </span>
                ) : isCandidate ? (
                  <span
                    className={`mt-[3px] block text-[12px] ${current ? 'text-accent' : 'text-ink-faint'}`}
                  >
                    {delayText(delay)}
                  </span>
                ) : (
                  <span className="mt-1.5 flex items-center gap-2">
                    <Pill tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Pill>
                    <span className="text-[12px] text-ink-faint">already in the plan</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function delayFor(
  item: WishlistItemRow,
  input: EngineInput,
  anchor: Date,
): number | null {
  const plan = toPurchasePlan(item, anchor);
  const impact = evaluatePurchase(input, [plan]);
  return impact.headlineDelay?.delayMonths ?? null;
}

function delayText(delayMonths: number | null): string {
  if (delayMonths == null) return 'Does not push anything back';
  if (delayMonths < 0.05) return 'No delay to what you are saving for';
  return `+${delayMonths.toFixed(1)} months on your goals`;
}
