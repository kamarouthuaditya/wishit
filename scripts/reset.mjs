/**
 * Wipes one account's rows and puts its profile back to defaults, so the app
 * starts at the setup screen again.
 *
 *   node scripts/reset.mjs --owner you@example.com            # back up, then wipe
 *   node scripts/reset.mjs --owner you@example.com --dry-run  # just show what would go
 *
 * The owner is required, and this is the change that matters most in this file.
 * It connects with the service-role key, which row level security does not
 * apply to, so an unscoped `delete` here empties the table for *everybody* —
 * including the testers whose data you have no copy of. One address, one
 * account's rows.
 *
 * Always writes a timestamped backup to .wishit/ first. Nothing here is
 * recoverable from Supabase otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry-run');

const ownerFlag = process.argv.indexOf('--owner');
const ownerEmail = ownerFlag === -1 ? null : process.argv[ownerFlag + 1];
if (!ownerEmail || ownerEmail.startsWith('--')) {
  console.error(
    'Whose data is being reset?\n\n' +
      '  node scripts/reset.mjs --owner you@example.com --dry-run\n\n' +
      'Without an owner this would delete every account\'s rows, not just yours.',
  );
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

// profile is reset rather than deleted — the app expects exactly one row.
const TABLES = [
  'simulation_run',
  'goal_contribution',
  'scenario',
  'wishlist_item',
  'monthly_snapshot',
  'transaction',
  'expense_item',
  'income',
  'loan',
  'credit_card',
  'goal',
  'career_entry',
];

const PROFILE_DEFAULTS = {
  name: 'Me',
  currency: 'INR',
  fiscal_month_start: 1,
  pay_date: 1,
  liquid_corpus: 0,
  emergency_floor: 0,
  annual_return_pct: 0,
  annual_inflation_pct: 0,
  bonus_mode: 'lump',
  allocation_mode: 'waterfall',
  horizon_months: 36,
  setup_complete: false,
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(process.cwd(), '.wishit');

async function backupAndWipeSupabase() {
  if (!url || !key) {
    console.log('Supabase not configured — skipping.');
    return;
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: accounts, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(`Could not list accounts: ${listError.message}`);
  const owner = accounts.users.find(
    (user) => (user.email ?? '').toLowerCase() === ownerEmail.toLowerCase(),
  );
  if (!owner) throw new Error(`No account for ${ownerEmail}.`);
  const userId = owner.id;
  console.log(`Owner: ${ownerEmail} (${userId})`);

  const dump = {};
  for (const table of [...TABLES, 'profile']) {
    const { data, error } = await db.from(table).select('*').eq('user_id', userId);
    if (error) throw new Error(`${table}: ${error.message}`);
    dump[table] = data;
  }

  const total = Object.values(dump).reduce((n, rows) => n + rows.length, 0);
  console.log(`Supabase: ${total} row(s) across ${Object.keys(dump).length} tables`);
  if (DRY) return;

  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, `backup-supabase-${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`Backed up to ${path.relative(process.cwd(), backup)}`);

  for (const table of TABLES) {
    const { error } = await db.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  const { data: rows } = await db.from('profile').select('id').eq('user_id', userId);
  if (rows?.length) {
    // Keep the first profile row, reset it, drop any duplicates.
    const [keep, ...extra] = rows;
    const { error } = await db
      .from('profile')
      .update(PROFILE_DEFAULTS)
      .eq('id', keep.id);
    if (error) throw new Error(`profile: ${error.message}`);
    for (const row of extra) await db.from('profile').delete().eq('id', row.id);
  } else {
    await db.from('profile').insert({ ...PROFILE_DEFAULTS, user_id: userId });
  }
  console.log(`Supabase wiped for ${ownerEmail}, profile back to defaults.`);
}

function backupAndWipeLocal() {
  const file = path.join(dir, 'data.json');
  if (!fs.existsSync(file)) {
    console.log('No local store to clear.');
    return;
  }
  if (DRY) {
    console.log('Local store: would be moved aside.');
    return;
  }
  const target = path.join(dir, `backup-local-${stamp}.json`);
  fs.renameSync(file, target);
  console.log(`Local store moved to ${path.relative(process.cwd(), target)}`);
}

async function main() {
  if (DRY) console.log('DRY RUN — nothing will be deleted\n');
  await backupAndWipeSupabase();
  backupAndWipeLocal();
  console.log(DRY ? '\nNothing changed.' : '\nDone. Open /setup to start fresh.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
