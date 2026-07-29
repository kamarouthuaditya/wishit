import { driver } from '@/lib/db/driver';
import { currentUser, isAuthConfigured } from '@/lib/supabase/server';
import { isoDate } from '@/lib/format';
import type { TableName } from '@/lib/db/types';

/**
 * Everything, in one file.
 *
 * Spending already exported as CSV, which is the right shape for a spreadsheet
 * and the wrong shape for a model: expenses have effective dates, goals have
 * priorities and lifecycles, loans have schedules. Flattening all of that into
 * one table loses the relationships that make the figures mean anything.
 *
 * So this is JSON — the rows as they are stored, one array per table. It reads
 * through the ordinary user-scoped client, so row level security decides what
 * lands in the file: an export cannot contain what a page could not show.
 */

const TABLES: TableName[] = [
  'profile',
  'income',
  'expense_item',
  'transaction',
  'loan',
  'credit_card',
  'goal',
  'goal_contribution',
  'wishlist_item',
  'monthly_snapshot',
];

export async function GET() {
  const user = isAuthConfigured ? await currentUser() : null;
  if (isAuthConfigured && !user) {
    return new Response('Sign in first.', { status: 401 });
  }

  const db = driver();
  const data: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    // Sequential rather than parallel: a Supabase project on the free tier has
    // a small connection pool, and an export is not worth exhausting it.
    data[table] = await db.list(table);
  }

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: user?.email ?? 'local',
      // Named so a future importer can tell which shape it is looking at.
      format: 'wishit.export.v1',
      data,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="wishit-export-${isoDate()}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
