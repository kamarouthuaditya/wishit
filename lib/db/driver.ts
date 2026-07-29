import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import { assertProductionEnv } from '@/lib/env';
import { redirect } from 'next/navigation';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TableName } from './types';

/**
 * Two drivers behind one interface.
 *
 * Supabase is the real one, and it runs as the signed-in user so row level
 * security does the isolating. The JSON file driver exists so the app is usable
 * the minute you clone it, before any cloud setup - the spec's "usable in 3
 * minutes" rule. It has no concept of users: it is a single-person dev store,
 * never a deployment target.
 */
export interface Driver {
  readonly kind: 'supabase' | 'local';
  list<T>(table: TableName): Promise<T[]>;
  insert<T extends object>(table: TableName, row: Partial<T>): Promise<T>;
  update<T extends object>(
    table: TableName,
    id: string,
    patch: Partial<T>,
  ): Promise<T>;
  remove(table: TableName, id: string): Promise<void>;
  /** Replaces every row in a table. Used by the setup wizard. */
  replaceAll<T extends object>(table: TableName, rows: Partial<T>[]): Promise<T[]>;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

/**
 * Every query runs as the signed-in user, so row level security — not this
 * code — decides which rows exist. Nothing here filters by user_id: a filter
 * can be forgotten, a policy cannot.
 *
 * The client is built per request because the session lives in cookies, so it
 * must not be cached across users.
 */
function supabase(): Promise<SupabaseClient> {
  return supabaseServer();
}

/**
 * A failure with the database's own error code still attached.
 *
 * Callers occasionally need to tell one failure from another — a unique
 * violation on first run is a race to recover from, not an outage — and
 * matching on the text of a message is how that turns into a bug the next time
 * Postgres rewords one.
 */
export class DbError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'DbError';
  }
}

/** Postgres: a unique index rejected the row. */
export const UNIQUE_VIOLATION = '23505';

/**
 * Every Supabase failure lands here, because one of them is not really a
 * failure: a session that could not be refreshed.
 *
 * Postgres answers an expired token by returning nothing and saying so, which
 * used to surface as a thrown error on whatever the person had just clicked.
 * Being quietly signed out is normal — tokens expire — so it gets the normal
 * treatment: back to sign-in, told why, and returned to where they were.
 */
function fail(
  table: TableName,
  error: { message: string; code?: string },
): never {
  const expired =
    error.code === 'PGRST301' ||
    /jwt|token is expired|refresh[_ ]token|not authenticated/i.test(error.message);

  if (expired) redirect('/login?expired=1');

  throw new DbError(`${table}: ${error.message}`, error.code);
}

const supabaseDriver: Driver = {
  kind: 'supabase',
  async list<T>(table: TableName) {
    const { data, error } = await (await supabase())
      .from(table).select('*');
    if (error) fail(table, error);
    return (data ?? []) as T[];
  },
  async insert<T extends object>(table: TableName, row: Partial<T>) {
    // The client is untyped (no generated Database types), so its insert/update
    // generics resolve to `never`. Row shapes are enforced by lib/db/types.
    const { data, error } = await (await supabase())
      .from(table)
      .insert(row as never)
      .select()
      .single();
    if (error) fail(table, error);
    return data as T;
  },
  async update<T extends object>(
    table: TableName,
    id: string,
    patch: Partial<T>,
  ) {
    const { data, error } = await (await supabase())
      .from(table)
      .update(patch as never)
      .eq('id', id)
      .select()
      .single();
    if (error) fail(table, error);
    return data as T;
  },
  async remove(table: TableName, id: string) {
    const { error } = await (await supabase())
      .from(table).delete().eq('id', id);
    if (error) fail(table, error);
  },
  async replaceAll<T extends object>(table: TableName, rows: Partial<T>[]) {
    const del = await (await supabase())
      .from(table).delete().not('id', 'is', null);
    if (del.error) fail(table, del.error);
    if (rows.length === 0) return [];
    const { data, error } = await (await supabase())
      .from(table)
      .insert(rows as never)
      .select();
    if (error) fail(table, error);
    return (data ?? []) as T[];
  },
};

// ------------------------------------------------------------ local driver ---

const DATA_DIR = path.join(process.cwd(), '.wishit');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

type LocalDb = Record<string, Record<string, unknown>[]>;

let cache: LocalDb | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function readLocal(): Promise<LocalDb> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    cache = JSON.parse(raw) as LocalDb;
  } catch {
    cache = {};
  }
  return cache;
}

async function writeLocal(db: LocalDb): Promise<void> {
  cache = db;
  // Serialise writes so two concurrent actions cannot interleave a full-file
  // rewrite and lose one of them.
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  });
  return writeQueue;
}

const localDriver: Driver = {
  kind: 'local',
  async list<T>(table: TableName) {
    const db = await readLocal();
    return (db[table] ?? []) as T[];
  },
  async insert<T extends object>(table: TableName, row: Partial<T>) {
    const db = await readLocal();
    const created = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...row,
    } as T;
    db[table] = [...(db[table] ?? []), created as Record<string, unknown>];
    await writeLocal(db);
    return created;
  },
  async update<T extends object>(
    table: TableName,
    id: string,
    patch: Partial<T>,
  ) {
    const db = await readLocal();
    const rows = db[table] ?? [];
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`${table}: no row ${id}`);
    const next = { ...rows[index], ...patch };
    db[table] = rows.map((r, i) => (i === index ? next : r));
    await writeLocal(db);
    return next as T;
  },
  async remove(table: TableName, id: string) {
    const db = await readLocal();
    db[table] = (db[table] ?? []).filter((r) => r.id !== id);
    await writeLocal(db);
  },
  async replaceAll<T extends object>(table: TableName, rows: Partial<T>[]) {
    const db = await readLocal();
    const created = rows.map((row) => ({
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...row,
    }));
    db[table] = created as Record<string, unknown>[];
    await writeLocal(db);
    return created as T[];
  },
};

export function driver(): Driver {
  // In production the local driver is not a fallback, it is a data leak: no
  // sign-in, one shared ledger, and a filesystem the host discards. Fail loudly
  // instead. See lib/env.ts.
  assertProductionEnv();
  return isSupabaseConfigured ? supabaseDriver : localDriver;
}
