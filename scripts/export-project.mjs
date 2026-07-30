/**
 * Reads a whole Supabase project into one JSON file. Writes nothing, anywhere.
 *
 *   node scripts/export-project.mjs
 *   node scripts/export-project.mjs --env .env.tokyo
 *
 * This exists because a Supabase project's region is fixed when it is created.
 * Moving from one region to another is not a setting — it is a new project and
 * a copy, and this is the copying-out half. `import-project.mjs` is the other.
 *
 * Rows are taken with the service-role key so row level security does not hide
 * other people's data from the backup, and users are listed through the admin
 * API so that `user_id` can be re-pointed on the way in: the new project mints
 * its own ids, and a row still carrying the old one belongs to nobody and is
 * invisible to everybody.
 *
 * Passwords are not here and cannot be. The admin API does not expose password
 * hashes, so whoever imports has to decide what the accounts sign in with —
 * see the note `import-project.mjs` prints.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TABLES } from './tables.mjs';

const envFlag = process.argv.indexOf('--env');
const envFile = envFlag === -1 ? '.env.local' : process.argv[envFlag + 1];

function readEnv(file) {
  if (!fs.existsSync(file)) {
    console.error(`No ${file} to read connection details from.`);
    process.exit(1);
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
}

const env = readEnv(envFile);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    `Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ${envFile}`,
  );
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Reading ${new URL(url).host}\n`);

const { data: userList, error: userError } = await db.auth.admin.listUsers({
  perPage: 1000,
});
if (userError) {
  console.error('Could not list users:', userError.message);
  process.exit(1);
}

// Only what is needed to re-point ownership. No tokens, no metadata that the
// new project will mint for itself.
const users = userList.users.map((u) => ({
  id: u.id,
  email: u.email,
  user_metadata: u.user_metadata ?? {},
}));

const tables = {};
let total = 0;
for (const table of TABLES) {
  const { data, error } = await db.from(table).select('*');
  if (error) {
    // A table that does not exist here is not a failure: the export should
    // still be usable from a project that is a migration or two behind.
    console.log(`  ${table.padEnd(20)} skipped (${error.code ?? error.message})`);
    continue;
  }
  tables[table] = data ?? [];
  total += data?.length ?? 0;
  console.log(`  ${table.padEnd(20)} ${String(data?.length ?? 0).padStart(5)}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(process.cwd(), '.wishit');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `export-${stamp}.json`);

fs.writeFileSync(
  out,
  JSON.stringify(
    { exported_at: new Date().toISOString(), source: new URL(url).host, users, tables },
    null,
    2,
  ),
  'utf8',
);

console.log(`\n${total} rows, ${users.length} users → ${path.relative(process.cwd(), out)}`);
for (const u of users) console.log(`  ${u.email}`);
