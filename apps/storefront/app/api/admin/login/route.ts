/**
 * POST /api/admin/login - Authenticate an admin user and set a signed session
 * cookie plus (when available) a Medusa customer token.
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import { AUTH_COOKIE } from "@/lib/auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  signAdminSession,
} from "@/lib/admin-session";
import { query } from "@/lib/db";

// Simple in-memory rate limiter: 5 failed attempts per IP per 15 minutes
const FAILED_ATTEMPTS = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * The limiter keeps its state in this process, keyed by caller IP, and the E2E
 * suite signs in repeatedly from 127.0.0.1. Without an escape hatch the suite's
 * own login tests consume the budget and later runs fail with 429 rather than
 * the status they are asserting on. Only the throwaway E2E server sets this, so
 * production keeps the limiter intact.
 */
const RATE_LIMIT_DISABLED = process.env.E2E_DISABLE_RATE_LIMIT === "1";

function getIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remaining?: number } {
  if (RATE_LIMIT_DISABLED) return { allowed: true };
  const now = Date.now();
  const record = FAILED_ATTEMPTS.get(ip);
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    FAILED_ATTEMPTS.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const remaining = Math.ceil(
      (RATE_LIMIT_WINDOW - (now - record.firstAttempt)) / 1000 / 60
    );
    return { allowed: false, remaining: Math.max(remaining, 1) };
  }
  record.count++;
  return { allowed: true };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = FAILED_ATTEMPTS.get(ip);
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    FAILED_ATTEMPTS.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

async function lookupAdminUser(email: string): Promise<{
  role: string;
  passwordHash: string;
} | null> {
  try {
    const rows = await query<{
      role: string;
      password_hash: string;
      is_active: boolean;
    }>(
      "SELECT role, password_hash, is_active FROM admin_users WHERE lower(email) = $1 LIMIT 1",
      [email]
    );

    const row = rows[0];
    if (!row || row.is_active === false) return null;
    return { role: row.role || "viewer", passwordHash: row.password_hash || "" };
  } catch {
    // Table absent or unreachable: fall through to the env-based admin.
    return null;
  }
}

async function verifyAdminUserPassword(
  email: string,
  password: string
): Promise<{ role: string } | null> {
  const user = await lookupAdminUser(email);
  if (!user?.passwordHash) return null;
  try {
    const bcrypt = require("bcryptjs");
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? { role: user.role } : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Rate limiting
  const ip = getIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many failed login attempts. Try again in ${limit.remaining} minute(s).`,
      },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const isEnvAdmin =
    ADMIN_EMAILS.includes(email) || (ADMIN_EMAIL ? email === ADMIN_EMAIL : false);

  let role: string | null = null;

  if (isEnvAdmin && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    role = "super_admin";
  }

  if (!role) {
    const adminUser = await verifyAdminUserPassword(email, password);
    if (adminUser) role = adminUser.role;
  }

  // Fall back to a real Medusa customer login (works for any account whose
  // email is listed in ADMIN_EMAILS, e.g. accounts created by the seed script
  // with a password different from ADMIN_PASSWORD).
  let medusaToken: string | null = null;
  if (!role && isEnvAdmin) {
    try {
      const result = await medusa.loginCustomer(email, password);
      medusaToken = result.token;
      role = "super_admin";
    } catch {
      // handled below
    }
  } else if (role && isEnvAdmin) {
    // Best effort: also obtain a Medusa token so storefront account features
    // remain available in the same browser session.
    try {
      const result = await medusa.loginCustomer(email, password);
      medusaToken = result.token;
    } catch {
      // ignore
    }
  }

  if (!role) {
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true, email, role });

  res.cookies.set(
    ADMIN_SESSION_COOKIE,
    signAdminSession({ email, role }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    }
  );

  if (medusaToken) {
    res.cookies.set(AUTH_COOKIE, medusaToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
  }

  return res;
}
