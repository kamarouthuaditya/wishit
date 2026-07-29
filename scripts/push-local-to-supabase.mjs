/**
 * One-shot: copy .wishit/data.json into Supabase, as somebody.
 *
 *   node scripts/push-local-to-supabase.mjs --owner you@example.com --dry-run
 *   node scripts/push-local-to-supabase.mjs --owner you@example.com
 *   node scripts/push-local-to-supabase.mjs --owner you@example.com --force
 *
 * The owner is not optional, and that is the point. This script connects with
 * the service-role key, which bypasses row level security — so rows it writes
 * without a `user_id` land owned by nobody, and a policy of `user_id =
 * auth.uid()` then hides them from every account including yours. Data that
 * exists and cannot be read is worse than data that failed to import.
 *
 * Refuses to run against a database that already has data unless --force, so
 * it cannot silently double up rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const ownerFlag = process.argv.indexOf('--owner');
const ownerEmail = ownerFlag === -1 ? null : process.argv[ownerFlag + 1];
if (!ownerEmail || ownerEmail.startsWith('--')) {
  console.error(
    'Who owns these rows?\n\n' +
      '  node scripts/push-local-to-supabase.mjs --owner you@example.com --dry-run\n\n' +
      'Rows written without an owner are invisible to every account, because row\n' +
      'level security matches on user_id and theirs would be null.',
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
if (!url || !key) {
  console.error(
    'Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const file = path.join(process.cwd(), '.wishit', 'data.json');
if (!fs.existsSync(file)) {
  console.error(`No local store at ${file} — nothing to push.`);
  process.exit(1);
}
const local = JSON.parse(fs.readFileSync(file, 'utf8'));

// profile is handled separately: the migration already seeded exactly one row.
const TABLES = [
  'income',
  'expense_item',
  'transaction',
  'loan',
  'credit_card',
  'goal',
  'goal_contribution',
  'wishlist_item',
  'scenario',
  'monthly_snapshot',
  'career_entry',
];

const db = createClient(url, key, { auth: { persistSession: false } });

/**
 * The account id behind the address. Looked up rather than passed as a uuid so
 * the command reads as something a person can check before running it.
 */
async function resolveOwner(email) {
  // listUsers is paginated; a personal deployment has few accounts, and asking
  // for a page of 200 is cheaper than being clever.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`Could not list accounts: ${error.message}`);

  const match = data.users.find(
    (user) => (user.email ?? '').toLowerCase() === email.toLowerCase(),
  );
  if (!match) {
    throw new Error(
      `No account for ${email}. Sign up in the app first, then re-run this.`,
    );
  }
  return match.id;
}

async function main() {
  console.log(DRY ? 'DRY RUN — nothing will be written\n' : 'Pushing…\n');

  const userId = await resolveOwner(ownerEmail);
  console.log(`owner           ${ownerEmail} (${userId})\n`);

  // Safety check first.
  if (!FORCE) {
    for (const table of TABLES) {
      // Only this owner's rows count: another account having goals is not a
      // reason to refuse, and would make the script unusable on a shared
      // database the moment a second person signs up.
      const { data, error } = await db
        .from(table)
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      if (error) {
        console.error(`${table}: ${error.message}`);
        process.exit(1);
      }
      if (data.length > 0) {
        console.error(
          `${table} already has rows for ${ownerEmail}. Re-run with --force if you meant to add to them.`,
        );
        process.exit(1);
      }
    }
  }

  // Profile: update the seeded row rather than inserting a second one.
  const profile = local.profile?.[0];
  if (profile) {
    const fields = { ...profile, user_id: userId };
    // Let the database own identity and timestamps.
    delete fields.id;
    delete fields.created_at;
    delete fields.updated_at;
    // Scoped to the owner: migration 0009 allows one profile per account, and
    // picking "any profile row" would collide with somebody else's.
    const { data: existing } = await db
      .from('profile')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (DRY) {
      console.log(
        `profile         update ${existing?.[0]?.id ?? '(none)'} — salary corpus ${fields.liquid_corpus}, floor ${fields.emergency_floor}`,
      );
    } else if (existing?.[0]) {
      const { error } = await db
        .from('profile')
        .update(fields)
        .eq('id', existing[0].id);
      if (error) throw new Error(`profile: ${error.message}`);
      console.log('profile         updated');
    } else {
      const { error } = await db.from('profile').insert(fields);
      if (error) throw new Error(`profile: ${error.message}`);
      console.log('profile         inserted');
    }
  }

  for (const table of TABLES) {
    const rows = local[table] ?? [];
    if (rows.length === 0) continue;
    if (DRY) {
      console.log(`${table.padEnd(16)}${rows.length} row(s)`);
      continue;
    }
    // Stamped here rather than left to the column default: `auth.uid()` is
    // null on a service-role connection, so the default would own nothing.
    const { error } = await db
      .from(table)
      .insert(rows.map((row) => ({ ...row, user_id: userId })));
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`${table.padEnd(16)}${rows.length} row(s) inserted`);
  }

  console.log(
    DRY
      ? '\nPlan looks fine. Re-run without --dry-run to apply.'
      : '\nDone. Delete .wishit/data.json once you are happy with the cloud copy.',
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
