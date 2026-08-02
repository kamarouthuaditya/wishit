import { redirect } from 'next/navigation';
import { loadReadySnapshot } from '@/lib/db/repository';
import { toEngineInput } from '@/lib/model/to-engine';
import { WishlistRail } from '@/components/wishlist-rail';
import { WishlistAdd } from '@/components/wishlist-add';
import { Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * `/wishlist` is an address, not a screen: the rail-and-detail layout needs
 * something selected, so this sends you to whichever item is first in line —
 * and back to the rail alone, with nothing to decide on yet, when there is
 * nothing to select.
 */
export default async function WishlistIndexPage() {
  const snapshot = await loadReadySnapshot();
  const active = snapshot.wishlist.filter(
    (w) => w.status !== 'purchased' && w.status !== 'dropped',
  );

  if (active.length > 0) redirect(`/wishlist/${active[0].id}`);
  if (snapshot.wishlist.length > 0) redirect(`/wishlist/${snapshot.wishlist[0].id}`);

  const { input, anchor } = toEngineInput(snapshot);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6 pb-6">
        <div>
          <h1 className="font-display text-[30px] leading-none">Decide</h1>
          <p className="mt-2 max-w-prose text-[15px] text-ink-soft">
            What each thing costs you in time, not just in rupees.
          </p>
        </div>
        <WishlistAdd />
      </div>

      <div className="grid border-t border-line lg:grid-cols-[340px_minmax(0,1fr)]">
        <WishlistRail items={[]} input={input} anchor={anchor} selectedId={null} />
        <div className="py-8 lg:pl-9">
          <Empty>
            Nothing here yet. Use <strong>Want</strong> in the header, or the button above,
            to capture something the moment you think of it.
          </Empty>
        </div>
      </div>
    </div>
  );
}
