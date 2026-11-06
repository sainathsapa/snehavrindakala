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

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://medusa:medusa@localhost:5432/medusa";

async function lookupAdminUser(email: string): Promise<{
  role: string;
  passwordHash: string;
} | null> {
  try {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: DATABASE_URL });
    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT role, password_hash, is_active FROM admin_users WHERE lower(email) = $1 LIMIT 1",
        [email]
      );
      const row = res.rows[0];
      if (!row || row.is_active === false) return null;
      return { role: row.role || "viewer", passwordHash: row.password_hash || "" };
    } finally {
      client.release();
      pool.end();
    }
  } catch {
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
