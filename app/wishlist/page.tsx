import Link from 'next/link';
import { loadReadySnapshot } from '@/lib/db/repository';
import { setWishlistStatus } from '@/lib/actions';
import { candidatePlans, toEngineInput } from '@/lib/model/to-engine';
import { evaluatePurchase } from '@/lib/engine';
import { monthlyBalance } from '@/lib/model/balance';
import { inr } from '@/lib/format';
import { Button, Empty, Field, Money, Pill, Select } from '@/components/ui';
import {
  BreachList,
  CheckpointTable,
  GoalDelayTable,
  ImpactHeadline,
} from '@/components/impact-view';
import { WishlistItemForm } from '@/components/wishlist-item-form';
import { IconArrowRight, IconEdit } from '@/components/icons';
import { PageGuide } from '@/components/page-guide';
import type { WishlistItemRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  idea: 'neutral',
  planned: 'accent',
  committed: 'warn',
  purchased: 'good',
  dropped: 'neutral',
} as const;

/**
 * The status names are the one bit of jargon that actually changes the numbers,
 * so they are labelled by what they *do* rather than what they are called.
 */
const STATUS_LABEL = {
  idea: 'idea',
  planned: 'considering',
  committed: 'committed',
  purchased: 'purchased',
  dropped: 'dropped',
} as const;

/**
 * The wishlist, as a list of candidates you can weigh together.
 *
 * Selecting several and evaluating them as a set is the point of the page —
 * three purchases you can each afford individually can still be ruinous
 * together — so the selection lives at the top with its own action, and the
 * result lands directly under it rather than three cards away.
 */
export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.sim) ? params.sim : params.sim ? [params.sim] : [];
  const selected = raw.flatMap((s) => s.split(',')).filter(Boolean);

  const snapshot = await loadReadySnapshot();
  const { input, anchor } = toEngineInput(snapshot);
  const balance = monthlyBalance(snapshot);

  const active = snapshot.wishlist.filter(
    (w) => w.status !== 'purchased' && w.status !== 'dropped',
  );
  const archived = snapshot.wishlist.filter(
    (w) => w.status === 'purchased' || w.status === 'dropped',
  );
  const committed = active.filter((w) => w.status === 'committed');

  const candidates = candidatePlans(snapshot, selected, anchor);
  const stacked = candidates.length > 0 ? evaluatePurchase(input, candidates) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Wishlist</h1>
            <PageGuide guide="wishlist" />
          </div>
          <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
            What each thing costs you in time, not just in rupees. Nothing here
            touches your projections until you mark it <strong>committed</strong>,
            so you can model freely.
          </p>
        </div>

        <dl className="flex items-end gap-px border border-line bg-line">
          <Figure label="Ideas" value={active.length - committed.length} plain />
          <Figure label="Committed" value={committed.length} plain />
          <Figure label="Balance left" value={balance.balance} lead />
        </dl>
      </header>

      {/* One list, not two. The checkboxes belong to the scenario form through
          the `form` attribute, which frees each row to also be a disclosure
          holding its own edit panel — a checkbox nested inside a summary fights
          the summary for every click. */}
      <form method="get" id="scenario" />

      {snapshot.wishlist.length === 0 ? (
        <Empty>
          Nothing here yet. Use <strong>Want</strong> in the header to capture
          something the moment you think of it.
        </Empty>
      ) : (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line-strong pb-2">
            <div>
              <h2 className="eyebrow">Weigh them together</h2>
              <p className="mt-1 text-[13px] text-ink-faint">
                Tick several: three purchases you can each afford alone can still
                be ruinous as a set.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-ink-faint">
                {selected.length === 0
                  ? 'nothing selected'
                  : `${selected.length} selected`}
              </span>
              <Button type="submit" form="scenario">
                Evaluate
              </Button>
              {selected.length > 0 && (
                <Link
                  href="/wishlist"
                  className="text-[12px] text-ink-faint hover:text-accent"
                >
                  Clear
                </Link>
              )}
            </div>
          </div>

          <ul className="divide-y divide-line">
            {[...active, ...archived].map((item) => {
              const gone = item.status === 'purchased' || item.status === 'dropped';
              return (
                <li key={item.id} className="group flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="sim"
                    form="scenario"
                    value={item.id}
                    defaultChecked={selected.includes(item.id)}
                    disabled={gone}
                    className="mt-4 size-4 shrink-0 accent-[var(--accent)] disabled:opacity-30"
                    aria-label={`Include ${item.name} in the scenario`}
                  />

                  <details className="min-w-0 flex-1">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 py-3 transition-colors duration-[140ms] hover:bg-surface-lift">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[15px] ${gone ? 'text-ink-faint line-through' : ''}`}
                          >
                            {item.name}
                          </span>
                          <Pill tone={STATUS_TONE[item.status]}>
                            {STATUS_LABEL[item.status]}
                          </Pill>
                          {item.is_no_cost && <Pill tone="warn">no-cost EMI</Pill>}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-ink-faint">
                          {describeMode(item)}
                          {item.reason ? ` · ${item.reason}` : ''}
                        </span>
                      </span>

                      <span className="tnum text-[16px]">{inr(Number(item.price))}</span>
                      <span className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                        <IconEdit size={15} />
                      </span>
                    </summary>

                    <div className="space-y-5 border-t border-line bg-paper px-4 py-5">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <form
                          action={setWishlistStatus}
                          className="flex flex-wrap items-end gap-3"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <div className="w-64">
                            <Field
                              label="Status"
                              hint="Only committed items enter your projections"
                            >
                              <Select name="status" defaultValue={item.status}>
                                <option value="idea">Idea</option>
                                <option value="planned">Considering</option>
                                <option value="committed">
                                  Committed — counts against surplus
                                </option>
                                <option value="purchased">Purchased</option>
                                <option value="dropped">Dropped</option>
                              </Select>
                            </Field>
                          </div>
                          <Button variant="ghost" type="submit">
                            Update
                          </Button>
                        </form>

                        <Link
                          href={`/wishlist/${item.id}`}
                          className="inline-flex items-center gap-1 pb-2 text-[13px] text-accent"
                        >
                          What it costs in time
                          <IconArrowRight size={14} />
                        </Link>
                      </div>

                      <WishlistItemForm item={item} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {stacked && (
        <section className="space-y-6 border-t-2 border-t-accent bg-surface p-5">
          <ImpactHeadline
            impact={stacked}
            anchor={anchor}
            title={
              candidates.length === 1
                ? 'If you buy it'
                : `If you buy all ${candidates.length}`
            }
          />
          <BreachList impact={stacked} anchor={anchor} />
          <div className="grid gap-6 lg:grid-cols-2">
            <GoalDelayTable impact={stacked} />
            <CheckpointTable impact={stacked} anchor={anchor} />
          </div>
        </section>
      )}

      <section>
        <h2 className="eyebrow border-b border-line-strong pb-2">
          Add something in full
        </h2>
        <p className="mt-2 text-[13px] text-ink-faint">
          Or use <strong>Want</strong> in the header for a name and a price, and
          fill the rest in later.
        </p>
        <div className="mt-4">
          <WishlistItemForm />
        </div>
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  lead,
  plain,
}: {
  label: string;
  value: number;
  lead?: boolean;
  plain?: boolean;
}) {
  return (
    <div className={`bg-surface px-4 py-2.5 ${lead ? 'border-t-2 border-t-accent' : ''}`}>
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className={`tnum mt-1 ${lead ? 'text-[17px] font-semibold' : 'text-[15px]'}`}>
        {plain ? value : <Money amount={value} />}
      </dd>
    </div>
  );
}

function describeMode(item: WishlistItemRow): string {
  switch (item.purchase_mode) {
    case 'cash':
      return 'paid in full';
    case 'emi':
      return `${inr(Number(item.emi_amount ?? 0))} × ${item.emi_tenure ?? 0} months`;
    case 'down-payment-emi':
      return `${inr(Number(item.down_payment ?? 0))} down, then EMI`;
    case 'save-then-buy':
      return `saving ${inr(Number(item.monthly_saving ?? 0))} a month`;
  }
}
