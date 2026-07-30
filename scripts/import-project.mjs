/**
 * Writes an `export-project.mjs` file into a fresh Supabase project.
 *
 *   node scripts/import-project.mjs --file .wishit/export-....json --env .env.mumbai --dry-run
 *   node scripts/import-project.mjs --file .wishit/export-....json --env .env.mumbai
 *
 * The other half of moving regions. Run the migrations in the new project
 * first — this copies rows, it does not create tables.
 *
 * Two things are not carried across, both on purpose:
 *
 * Passwords. The admin API does not expose password hashes, so there is no way
 * to move them and no way for this script to set one without being handed a
 * password in plain text, which it should never be. Accounts arrive confirmed
 * but with no password, and their owner sets one through "Forgot password" —
 * the flow already in the app. That is one email each, and nobody's password
 * has ever been in a file.
 *
 * User ids. The new project mints its own. Rows are re-pointed by matching on
 * email, because a row still carrying the old `user_id` satisfies no policy and
 * would be invisible to the very account it belongs to.
 *
 * Refuses to write into a project that already has rows unless --force, so a
 * second run cannot quietly double everything.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TABLES } from './tables.mjs';

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

function flag(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  return !value || value.startsWith('--') ? fallback : value;
}

const file = flag('--file');
const envFile = flag('--env', '.env.local');

if (!file) {
  console.error(
    'Which export?\n\n' +
      '  node scripts/import-project.mjs --file .wishit/export-....json --env .env.mumbai --dry-run\n',
  );
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`No such export: ${file}`);
  process.exit(1);
}
if (!fs.existsSync(envFile)) {
  console.error(`No ${envFile}. Point --env at the new project's keys.`);
  process.exit(1);
}

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
  console.error(
    `Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ${envFile}`,
  );
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
const target = new URL(url).host;

if (dump.source === target) {
  console.error(
    `That export came from ${dump.source}, which is where you are pointing it.\n` +
      'Importing a project into itself would double every row.',
  );
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`${dump.source}  →  ${target}`);
console.log(`${DRY ? 'DRY RUN — nothing will be written\n' : ''}`);

// ------------------------------------------------------------- safety check ---

let existing = 0;
for (const table of TABLES) {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error(
      `Cannot read ${table} in the new project (${error.code ?? error.message}).\n` +
        'Run every file in supabase/migrations/ there first — this script copies\n' +
        'rows, it does not create tables.',
    );
    process.exit(1);
  }
  existing += count ?? 0;
}

if (existing > 0 && !FORCE) {
  console.error(
    `The new project already holds ${existing} rows. Refusing to add to them.\n` +
      'Empty it first, or pass --force if you are certain.',
  );
  process.exit(1);
}

// -------------------------------------------------------------------- users ---

const { data: current, error: listError } = await db.auth.admin.listUsers({
  perPage: 1000,
});
if (listError) {
  console.error('Could not list users in the new project:', listError.message);
  process.exit(1);
}

const byEmail = new Map(
  current.users.map((u) => [String(u.email).toLowerCase(), u.id]),
);

/** old user id → new user id */
const remap = new Map();
const needPassword = [];

for (const user of dump.users) {
  const email = String(user.email).toLowerCase();
  const already = byEmail.get(email);

  if (already) {
    remap.set(user.id, already);
    console.log(`  user ${email} — already there`);
    continue;
  }

  if (DRY) {
    console.log(`  user ${email} — would create (confirmed, no password)`);
    remap.set(user.id, `dry-run-${user.id}`);
    needPassword.push(user.email);
    continue;
  }

  const { data, error } = await db.auth.admin.createUser({
    email: user.email,
    // Confirmed on arrival: this address already proved itself in the old
    // project, and making people verify an address twice to move regions is
    // a chore invented by the migration, not a security decision.
    email_confirm: true,
    user_metadata: user.user_metadata ?? {},
  });

  if (error) {
    console.error(`  user ${email} — FAILED: ${error.message}`);
    process.exit(1);
  }

  remap.set(user.id, data.user.id);
  needPassword.push(user.email);
  console.log(`  user ${email} — created`);
}

// -------------------------------------------------------------------- rows ---

console.log();
let written = 0;
const orphaned = [];

for (const table of TABLES) {
  const rows = dump.tables[table] ?? [];
  if (rows.length === 0) continue;

  const mapped = rows.map((row) => {
    if (!('user_id' in row) || row.user_id == null) return row;
    const next = remap.get(row.user_id);
    if (!next) {
      orphaned.push(`${table}:${row.id}`);
      return row;
    }
    return { ...row, user_id: next };
  });

  if (DRY) {
    console.log(`  ${table.padEnd(20)} ${String(mapped.length).padStart(5)} would insert`);
    written += mapped.length;
    continue;
  }

  // Ids are kept as they were, so anything referencing another table still
  // points at the row it always did.
  const { error } = await db.from(table).insert(mapped);
  if (error) {
    console.error(`  ${table.padEnd(20)} FAILED: ${error.message}`);
    process.exit(1);
  }
  written += mapped.length;
  console.log(`  ${table.padEnd(20)} ${String(mapped.length).padStart(5)} inserted`);
}

console.log(`\n${written} rows ${DRY ? 'would be written' : 'written'}.`);

if (orphaned.length > 0) {
  console.warn(
    `\n${orphaned.length} rows had a user_id with no matching email and were left ` +
      'pointing at the old id. Row level security will hide them from everyone:\n  ' +
      orphaned.slice(0, 10).join('\n  '),
  );
}

if (needPassword.length > 0) {
  console.log(
    '\nThese accounts exist and are confirmed, but have no password yet.\n' +
      'Each needs to use "Forgot password" once, on the new deployment:\n  ' +
      needPassword.join('\n  '),
  );
}
