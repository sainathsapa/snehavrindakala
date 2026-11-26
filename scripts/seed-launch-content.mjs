#!/usr/bin/env node
/**
 * Launch seed: the two things a fresh database must have before the shop can be
 * shown to anyone.
 *
 *  1. Owner accounts. Every admin login lived only in the developer's local
 *     database, so the deploy would have had no way in at all — the panel would
 *     have been reachable only through the env fallback, which is one address and
 *     no password reset.
 *  2. The editorial sections the nav points at. Rooms and the newsroom were
 *     seeded by hand locally; on a new box they would have been empty pages
 *     behind a menu that promises something.
 *
 * Idempotent on purpose: it runs on every deploy, and re-running it must never
 * duplicate a room, overwrite copy the owner has edited, or reset a password
 * somebody has since changed.
 *
 * Reads the content from deploy/seed/*.json rather than from this file, so the
 * words are reviewable as data and can be edited without touching code.
 *
 * Usage:
 *   node scripts/seed-launch-content.mjs           # against DATABASE_URL
 *   node scripts/seed-launch-content.mjs --docker  # through `docker compose exec`
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USE_DOCKER = process.argv.includes("--docker");

const envFile = readEnv(join(ROOT, ".env"));

function readEnv(path) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = { ...envFile, ...process.env };
const DATABASE_URL = String(env.DATABASE_URL || "").replace(/^["']|["']$/g, "");

/** Literal SQL string, with single quotes doubled. */
const q = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;

/**
 * Run one SQL batch. Either straight to the database with psql, or through the
 * container — a deploy box has Docker and psql inside it, not necessarily on the
 * host.
 */
function runSql(statement) {
  if (USE_DOCKER) {
    const match = /^postgres(?:ql)?:\/\/([^:]+):[^@]*@([^:/]+)(?::(\d+))?\/([^?]+)/.exec(DATABASE_URL);
    const user = match?.[1] || "medusa";
    const database = match?.[4] || "medusa";
    execFileSync(
      "docker",
      ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database],
      { cwd: ROOT, input: statement, stdio: ["pipe", "inherit", "inherit"] }
    );
    return;
  }
  execFileSync("psql", [DATABASE_URL, "-v", "ON_ERROR_STOP=1"], {
    input: statement,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

const readJson = (name) => JSON.parse(readFileSync(join(ROOT, "deploy", "seed", name), "utf8"));

// ── 1. Rooms ────────────────────────────────────────────────────────────────
const rooms = readJson("rooms.json");
const roomSql = rooms
  .map(
    (room) => `INSERT INTO site_room
  (slug, title, kicker, subtitle, body, image, collection, position, published,
   title_hi, subtitle_hi, body_hi)
VALUES
  (${q(room.slug)}, ${q(room.title)}, ${q(room.kicker)}, ${q(room.subtitle)},
   ${q(room.body)}, ${q(room.image)}, ${q(room.collection)}, ${Number(room.position) || 0},
   ${room.published ? "true" : "false"}, ${q(room.title_hi)}, ${q(room.subtitle_hi)},
   ${q(room.body_hi)})
ON CONFLICT (slug) DO NOTHING;`
  )
  .join("\n");

// ── 2. Newsroom ─────────────────────────────────────────────────────────────
const news = readJson("newsroom.json");
const newsSql = news
  .map(
    (item) => `INSERT INTO site_news
  (slug, title, kind, outlet, url, summary, body, image, position, published,
   published_at, title_hi, summary_hi, body_hi)
VALUES
  (${q(item.slug)}, ${q(item.title)}, ${q(item.kind)}, ${q(item.outlet)}, ${q(item.url)},
   ${q(item.summary)}, ${q(item.body)}, ${q(item.image)}, ${Number(item.position) || 0},
   ${item.published ? "true" : "false"}, ${q(item.published_at || new Date().toISOString())},
   ${q(item.title_hi)}, ${q(item.summary_hi)}, ${q(item.body_hi)})
ON CONFLICT (slug) DO NOTHING;`
  )
  .join("\n");

console.log(`[seed] inserting ${rooms.length} rooms and ${news.length} newsroom entries`);
runSql(`${roomSql}\n${newsSql}`);

// ── 3. Owner accounts ───────────────────────────────────────────────────────
//
// The password comes from ADMIN_PASSWORD, never from this file: a seeded
// credential written into the repository is a credential that leaks with it.
// Existing rows keep their hash — a deploy must not silently reset a password
// somebody changed on purpose.
const owners = [...new Set(
  [env.ADMIN_EMAIL, ...String(env.ADMIN_EMAILS || "").split(",")]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
)];

const password = String(env.ADMIN_PASSWORD || "");
if (owners.length === 0) {
  console.warn("[seed] no ADMIN_EMAIL or ADMIN_EMAILS set — skipping owner accounts");
} else if (!password) {
  console.warn("[seed] ADMIN_PASSWORD is empty — owner accounts cannot be created");
} else {
  // Hashed in SQL with pgcrypto's bcrypt (gen_salt('bf', 10)).
  //
  // bcryptjs lives in the storefront image and the host may not have it, so the
  // script does not depend on either: Postgres can produce a $2a$ hash directly,
  // and bcryptjs verifies that format. The password travels over stdin with the
  // rest of the batch, never as a process argument where `ps` would show it.
  const hashExpr = (pw) => `crypt(${q(pw)}, gen_salt('bf', 10))`;
  const ownerSql = owners
    .map(
      (email) => `INSERT INTO admin_users (email, password_hash, role, is_active)
VALUES (${q(email)}, ${hashExpr(password)}, 'platform_super_admin', true)
ON CONFLICT (email) DO UPDATE
  SET role = 'platform_super_admin',
      is_active = true,
      updated_at = now();`
    )
    .join("\n");
  console.log(`[seed] owners: ${owners.join(", ")}`);
  runSql(`CREATE EXTENSION IF NOT EXISTS pgcrypto;\n${ownerSql}`);
}

// ── 4. Report ───────────────────────────────────────────────────────────────
runSql(
  `SELECT
     (SELECT count(*) FROM site_room WHERE published)  AS rooms_published,
     (SELECT count(*) FROM site_news WHERE published)  AS newsroom_published,
     (SELECT count(*) FROM admin_users)                AS owners;`
);
