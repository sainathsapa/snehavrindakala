/**
 * A guard that stops this repository from locking the Shiprocket account.
 *
 * Shiprocket counts failed logins and locks the account for two hours when the
 * count crosses its limit. Nothing in their API tells a caller how many attempts
 * are left, so a check that runs in a loop — or a preflight that runs on every
 * deploy — can trip the lock and then keep re-tripping it, which is exactly what
 * happened: a diagnosis session locked the account and every retry afterwards
 * extended it.
 *
 * The rule this enforces: after one failed authentication, do not try again for
 * two hours, from anywhere in this repo. The state lives in a file so it survives
 * a new process, a new shell and a redeploy.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATE = join(ROOT, ".shiprocket-lockout.json");

/** Shiprocket's own wording: "temporarily locked access for the next 2 hours". */
const LOCK_MS = 2 * 60 * 60 * 1000 + 5 * 60 * 1000;

function read() {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * { locked: true, until: Date, reason } when a recent failure should stop us.
 * Call this before any login attempt.
 */
export function cooldownStatus() {
  const state = read();
  if (!state?.at) return { locked: false };
  const until = new Date(state.at + LOCK_MS);
  if (Date.now() > until.getTime()) return { locked: false };
  return { locked: true, until, reason: state.reason || "previous failed login" };
}

/** Record a failed authentication. Everything in this repo now waits. */
export function recordAuthFailure(reason) {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ at: Date.now(), reason }, null, 2));
}

/** Clear the lock — only after a login that actually succeeded. */
export function recordAuthSuccess() {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ at: 0, reason: "authenticated" }, null, 2));
}

export function describeCooldown(status) {
  if (!status.locked) return "";
  const minutes = Math.max(1, Math.ceil((status.until.getTime() - Date.now()) / 60000));
  return `Shiprocket authentication is on cooldown for another ${minutes} minute(s) (${status.reason}). Shiprocket locks an account for 2 hours after failed logins and every retry inside that window extends it. Do not retry; rerun after ${status.until.toLocaleTimeString("en-IN")}.`;
}
