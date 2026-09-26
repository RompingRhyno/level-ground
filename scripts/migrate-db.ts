/**
 * Database migration helper: dump the live database and restore it into the new one, then verify.
 *
 *   npx tsx scripts/migrate-db.ts --dump      # pg_dump  (source)  -> ~/lg-migration-dumps/
 *   npx tsx scripts/migrate-db.ts --restore   # pg_restore (target) <- newest dump
 *   npx tsx scripts/migrate-db.ts --verify    # compare source vs target, row by row
 *
 * Connection strings come from .env.local: the live database from DATABASE_URL_UNPOOLED /
 * NEON_DATABASE_URL_UNPOOLED / DATABASE_URL, the destination from MIGRATE_DB_URL_UNPOOLED
 * (unpooled on purpose — Neon's -pooler endpoint cannot serve dump/restore). They are handed to
 * the binaries through the child process environment, so no password ever reaches argv, a
 * command line, or this script's output.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Client } from "pg";
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DUMP_DIR = join(process.env.HOME ?? "/tmp", "lg-migration-dumps");

function sourceUrl(): string {
  const v = process.env.DATABASE_URL_UNPOOLED ?? process.env.NEON_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!v) throw new Error("no source database URL in env");
  return v;
}
function targetUrl(): string {
  const v = process.env.MIGRATE_DB_URL_UNPOOLED;
  if (!v) throw new Error("MIGRATE_DB_URL_UNPOOLED is not set");
  return v;
}

/** libpq-style env so the password travels in the environment, not in argv. */
function pgEnv(connUrl: string): Record<string, string> {
  const u = new URL(connUrl);
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.replace(/^\//, ""),
    PGSSLMODE: (() => {
      const requested = u.searchParams.get("sslmode") ?? "require";
      const rootcert = process.env.PGSSLROOTCERT ?? "system";
      // PG 18's libpq rejects a weak sslmode next to sslrootcert=system, and already treats
      // `require` as verify-full internally — say it explicitly so both binaries accept it.
      return rootcert === "system" && /^(require|prefer|verify-ca)$/.test(requested) ? "verify-full" : requested;
    })(),
    PGSSLROOTCERT: process.env.PGSSLROOTCERT ?? "system",
    ...(u.searchParams.get("channel_binding") ? { PGCHANNELBINDING: u.searchParams.get("channel_binding")! } : {}),
  };
}

function run(bin: string, args: string[], connUrl: string, quiet = false): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { env: { ...process.env, ...pgEnv(connUrl) } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      if (!quiet) console.log(out.trim());
      resolve({ code: code ?? 1, out });
    });
  });
}

function newestDump(): string {
  const files = readdirSync(DUMP_DIR)
    .filter((f) => f.endsWith(".pgc"))
    .map((f) => ({ f, m: statSync(join(DUMP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (!files.length) throw new Error(`no dump found in ${DUMP_DIR}`);
  return join(DUMP_DIR, files[0].f);
}

async function dump() {
  mkdirSync(DUMP_DIR, { recursive: true, mode: 0o750 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(DUMP_DIR, `level-ground-${stamp}.pgc`);
  const { code } = await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", file], sourceUrl());
  if (code !== 0) throw new Error(`pg_dump exited ${code}`);
  const listing = await run("pg_restore", ["--list", file], sourceUrl(), true);
  const tableData = (listing.out.match(/TABLE DATA/g) ?? []).length;
  const sequences = (listing.out.match(/SEQUENCE SET/g) ?? []).length;
  const size = (statSync(file).size / 1024).toFixed(0);
  console.log(`dump: ${file} (${size} KB)`);
  console.log(`contains: ${tableData} tables of data, ${sequences} sequence resets`);
}

async function restore() {
  const file = newestDump();
  console.log(`restoring ${file}`);
  const { code, out } = await run(
    "pg_restore",
    ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", "--dbname", pgEnv(targetUrl()).PGDATABASE!, file],
    targetUrl()
  );
  if (code !== 0) {
    console.error(out.split("\n").slice(-15).join("\n"));
    throw new Error(`pg_restore exited ${code}`);
  }
  console.log("restore: OK (single transaction, exit-on-error)");
}

async function verify() {
  const tables = (await query(sourceUrl(), `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).rows.map(
    (r) => r.table_name as string
  );
  let mismatches = 0;
  console.log(`comparing ${tables.length} tables\n`);

  for (const t of tables) {
    const [s, d] = await Promise.all([tableFingerprint(sourceUrl(), t), tableFingerprint(targetUrl(), t)]);
    const ok = s.count === d.count && s.hash === d.hash;
    if (!ok) mismatches++;
    console.log(
      `${ok ? "OK  " : "DIFF"} ${t.padEnd(22)} rows ${String(s.count).padStart(4)} / ${String(d.count).padStart(4)}  hash ${s.hash.slice(0, 8)} / ${d.hash.slice(0, 8)}`
    );
  }

  const seqs = (await query(sourceUrl(), `select sequence_name from information_schema.sequences where sequence_schema='public' order by 1`)).rows.map(
    (r) => r.sequence_name as string
  );
  console.log("");
  for (const s of seqs) {
    const [a, b] = await Promise.all([seqValue(sourceUrl(), s), seqValue(targetUrl(), s)]);
    const ok = String(a) === String(b);
    if (!ok) mismatches++;
    console.log(`${ok ? "OK  " : "DIFF"} sequence ${s.padEnd(28)} ${String(a).padStart(6)} / ${String(b).padStart(6)}`);
  }

  console.log(`\nmismatches: ${mismatches}`);
  if (mismatches) process.exitCode = 1;
}

async function query(connUrl: string, sql: string) {
  const c = new Client({ connectionString: connUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    return await c.query(sql);
  } finally {
    await c.end();
  }
}

/**
 * Row-count plus an order-independent content hash. `order by` inside string_agg keeps it stable;
 * casting the row to text makes this a real data comparison rather than a count.
 */
async function tableFingerprint(connUrl: string, table: string) {
  const r = await query(
    connUrl,
    `select count(*)::int as count, coalesce(md5(string_agg(x, '|' order by x)), 'empty') as hash
     from (select t::text as x from public."${table}" t) s`
  );
  return { count: r.rows[0].count as number, hash: r.rows[0].hash as string };
}

async function seqValue(connUrl: string, seq: string) {
  const r = await query(connUrl, `select last_value from public."${seq}"`);
  return r.rows[0].last_value;
}

const mode = process.argv[2];
const confirmed = process.argv.includes("--yes");
void (async () => {
  if (mode === "--dump") await dump();
  else if (mode === "--restore") await restore();
  else if (mode === "--verify") await verify();
  else if (mode === "--status") await status();
  else if (mode === "--resync") await resync(confirmed);
  else {
    console.log("usage: npx tsx scripts/migrate-db.ts --dump | --restore | --verify | --status");
    console.log("       npx tsx scripts/migrate-db.ts --resync --yes   (re-copy after new writes)");
    process.exitCode = 2;
  }
})().catch((err) => {
  console.error(`failed: ${err.message}`);
  process.exit(1);
});

/**
 * Fresh copy of the live database into the destination. Destructive to the DESTINATION only:
 * refuses when the destination host looks like the live host, and requires an explicit --yes.
 */
async function resync(confirmed: boolean) {
  const from = new URL(sourceUrl()).hostname;
  const to = new URL(targetUrl()).hostname;
  if (from === to) throw new Error("destination and source are the same host — refusing");
  if (!confirmed) {
    console.log(`would wipe all objects in the destination (${to.replace(/^[^.]+/, "<id>")}) and re-copy from the live database.`);
    console.log("re-run with --resync --yes to proceed.");
    process.exitCode = 2;
    return;
  }
  const client = new Client({ connectionString: targetUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("drop schema public cascade; create schema public;");
  await client.end();
  console.log("destination schema dropped and recreated");
  await dump();
  await restore();
  await verify();
}

/** Ask Prisma CLI what it thinks of the destination schema (should be 14 applied, no drift). */
async function status() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "status"], {
      env: { ...process.env, NEON_DATABASE_URL: targetUrl(), DATABASE_URL: targetUrl() },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", () => {
      console.log(out.trim());
      resolve();
    });
    child.on("error", reject);
  });
}
