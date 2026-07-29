import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadReadySnapshot, loadSnapshot } from '@/lib/db/repository';
import { toEngineInput, toPurchasePlan } from '@/lib/model/to-engine';
import { compareModes, evaluatePurchase, noCostEmiTrueCost } from '@/lib/engine';
import { inr } from '@/lib/format';
import { Card, Money, Pill } from '@/components/ui';
import {
  BreachList,
  CheckpointTable,
  GoalDelayTable,
  ImpactHeadline,
  ModeComparison,
} from '@/components/impact-view';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  idea: 'idea',
  planned: 'considering',
  committed: 'committed',
  purchased: 'purchased',
  dropped: 'dropped',
} as const;

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
  const impact = evaluatePurchase(input, [plan]);
  const modes = compareModes(input, plan, {
    tenure: item.emi_tenure ?? 6,
    ratePct: item.is_no_cost ? 0 : Number(item.annual_rate_pct),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/wishlist" className="text-[13px] text-accent">
            ← Wishlist
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {item.name}
            <Pill tone={item.status === 'committed' ? 'warn' : 'neutral'}>
              {STATUS_LABEL[item.status]}
            </Pill>
          </h1>
          {item.reason && (
            <p className="mt-1 max-w-prose text-[15px] text-ink-soft">{item.reason}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-[12px] uppercase tracking-wide text-ink-faint">
            Price
          </div>
          <div className="tnum text-2xl font-semibold">{inr(Number(item.price))}</div>
        </div>
      </div>

      <ImpactHeadline impact={impact} anchor={anchor} title="Purchase impact" />

      {item.is_no_cost && <NoCostPanel item={item} />}

      <BreachList impact={impact} anchor={anchor} />

      <div className="grid gap-6 lg:grid-cols-2">
        <GoalDelayTable impact={impact} />
        <CheckpointTable impact={impact} anchor={anchor} />
      </div>

      <ModeComparison rows={modes} />
    </div>
  );
}

function NoCostPanel({
  item,
}: {
  item: Awaited<ReturnType<typeof loadSnapshot>>['wishlist'][number];
}) {
  const cost = noCostEmiTrueCost({
    stickerPrice: Number(item.price),
    tenureMonths: item.emi_tenure ?? 6,
  });

  return (
    <Card title="No-cost EMI: true cost">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <div className="text-[12px] uppercase tracking-wide text-ink-faint">
            Sticker price
          </div>
          <div className="tnum mt-1 text-2xl font-semibold">
            {inr(cost.stickerPrice)}
          </div>
        </div>
        <div>
          <div className="text-[12px] uppercase tracking-wide text-warn">
            True cost
          </div>
          <div className="tnum mt-1 text-2xl font-semibold text-warn">
            {inr(cost.trueCost)}
          </div>
        </div>
        <div>
          <div className="text-[12px] uppercase tracking-wide text-ink-faint">
            Hidden cost
          </div>
          <div className="tnum mt-1 text-2xl font-semibold">
            <Money amount={cost.hiddenCost} tone="warn" />
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-prose text-[14px] text-ink-soft">
        The interest does not disappear — it is built into the price, usually as a
        cash discount you forgo. GST still applies to the {inr(cost.notionalInterest)}{' '}
        of notional interest the bank books. Add the cash discount you gave up on the
        loans page to sharpen this figure.
      </p>
    </Card>
  );
}
