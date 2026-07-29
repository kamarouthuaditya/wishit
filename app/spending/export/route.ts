import type { NextRequest } from 'next/server';
import { driver } from '@/lib/db/driver';
import { currentUser, isAuthConfigured } from '@/lib/supabase/server';
import { BOM, toCsv } from '@/lib/csv';
import type { TransactionRow } from '@/lib/db/types';

/**
 * Your spending log, as a file you own.
 *
 * `?month=YYYY-MM` for one month, nothing for everything. Rows come back
 * through the ordinary user-scoped client, so row level security decides what
 * is in the file — an export cannot leak what a page could not show.
 */
export async function GET(request: NextRequest) {
  if (isAuthConfigured && !(await currentUser())) {
    return new Response('Sign in first.', { status: 401 });
  }

  const month = request.nextUrl.searchParams.get('month');
  const scoped = /^\d{4}-\d{2}$/.test(month ?? '');

  const rows = await driver().list<TransactionRow>('transaction');
  const wanted = rows
    .filter((row) => (scoped ? row.date.slice(0, 7) === month : true))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Same columns the importer used to take, so the file round-trips through a
  // spreadsheet and back into anything else you use.
  const csv = toCsv([
    ['date', 'amount', 'category', 'note', 'one_off'],
    ...wanted.map((row) => [
      row.date.slice(0, 10),
      Number(row.amount),
      row.category,
      row.note ?? '',
      row.is_one_off ? 'true' : 'false',
    ]),
  ]);

  const filename = scoped ? `wishit-spending-${month}.csv` : 'wishit-spending-all.csv';

  return new Response(BOM + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // A statement of what you spent should never come from a cache.
      'Cache-Control': 'no-store',
    },
  });
}
