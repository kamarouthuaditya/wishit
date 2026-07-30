/**
 * Empties a Supabase project: every data row, then every account.
 *
 *   node scripts/wipe-project.mjs --dry-run
 *   node scripts/wipe-project.mjs --yes-really
 *
 * For starting over on a project that is not yet carrying anybody's real data.
 * There is no undo — the service-role key bypasses row level security, so this
 * empties the tables for every account at once, not just yours. Take an export
 * first; `export-project.mjs` writes one in seconds and `import-project.mjs`
 * puts it back.
 *
 * `--yes-really` rather than `--force` because the flag should be a sentence
 * somebody has to mean. A dry run is the default posture of this file: without
 * the flag it refuses, and with `--dry-run` it only counts.
 *
 * Rows go before users. Ownership is a foreign key into `auth.users`, and
 * whether that key cascades is a detail of a migration rather than something
 * worth betting the order of deletion on.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TABLES } from './tables.mjs';

const DRY = process.argv.includes('--dry-run');
const CONFIRMED = process.argv.includes('--yes-really');

if (!DRY && !CONFIRMED) {
  console.error(
    'This deletes every row and every account in the project.\n\n' +
      '  node scripts/wipe-project.mjs --dry-run     # count what would go\n' +
      '  node scripts/wipe-project.mjs --yes-really  # do it\n\n' +
      'Run `node scripts/export-project.mjs` first if the data matters at all.',
  );
  process.exit(1);
}

function flag(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  return !value || value.startsWith('--') ? fallback : value;
}

const envFile = flag('--env', '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`${DRY ? 'DRY RUN — ' : ''}emptying ${new URL(url).host}\n`);

/*
 * Children before parents, and the two transient tables alongside them:
 * `auth_code` holds codes sealed around OTPs and `auth_attempt` is the rate
 * limiter's memory, so both are meaningless once the accounts they refer to
 * are gone.
 */
const order = [...TABLES].reverse().concat(['auth_code', 'auth_attempt']);

let removed = 0;
for (const table of order) {
  const { count, error: countError } = await db
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.log(`  ${table.padEnd(20)} skipped (${countError.code ?? countError.message})`);
    continue;
  }
  if (!count) {
    console.log(`  ${table.padEnd(20)}     0`);
    continue;
  }

  if (DRY) {
    console.log(`  ${table.padEnd(20)} ${String(count).padStart(5)} would go`);
    removed += count;
    continue;
  }

  // `not id is null` matches every row. PostgREST refuses an unfiltered delete,
  // which is a good instinct in general and the thing being overridden here.
  const { error } = await db.from(table).delete().not('id', 'is', null);
  if (error) {
    console.error(`  ${table.padEnd(20)} FAILED: ${error.message}`);
    process.exit(1);
  }
  removed += count;
  console.log(`  ${table.padEnd(20)} ${String(count).padStart(5)} deleted`);
}

const { data, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('\nCould not list users:', listError.message);
  process.exit(1);
}

console.log();
for (const user of data.users) {
  if (DRY) {
    console.log(`  user ${user.email} — would delete`);
    continue;
  }
  const { error } = await db.auth.admin.deleteUser(user.id);
  console.log(`  user ${user.email} — ${error ? 'FAILED: ' + error.message : 'deleted'}`);
  if (error) process.exit(1);
}

console.log(
  `\n${removed} rows and ${data.users.length} accounts ${DRY ? 'would be removed' : 'removed'}.`,
);
