/**
 * Admin Users API - manages admin users and roles in PostgreSQL.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminIdentity, requireAdmin, requirePermission } from "@/app/admin/actions";
import { recordAdminAction } from "@/lib/audit";



export async function GET(req: Request) {
  if (!(await requirePermission("users:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await query(
      "SELECT id, email, role, is_active, created_at, updated_at FROM admin_users ORDER BY created_at DESC"
    );
    return NextResponse.json({ users: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requirePermission("users:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { email, password, role = "viewer" } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require("uuid");
    const id = `admin_${uuidv4().slice(0, 8)}`;

    const rows = await query(
      `INSERT INTO admin_users (id, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, email, role, is_active, created_at, updated_at`,
      [id, email, passwordHash, role]
    );

    const actor = await getAdminIdentity();
    if (actor) {
      await recordAdminAction({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin_user.create",
        entityType: "admin_user",
        entityId: id,
        newValues: { email, role }, // never audit the password hash
      });
    }

    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await requirePermission("users:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { id, role, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (role !== undefined) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }
    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    params.push(id);
    const sql = `UPDATE admin_users SET ${updates.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING id, email, role, is_active`;

    const rows = await query(sql, params);
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const actor = await getAdminIdentity();
    if (actor) {
      await recordAdminAction({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin_user.update",
        entityType: "admin_user",
        entityId: id,
        newValues: { role, is_active },
      });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await requirePermission("users:delete"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    await query("DELETE FROM admin_users WHERE id = $1", [id]);
    const actor = await getAdminIdentity();
    if (actor) {
      await recordAdminAction({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin_user.delete",
        entityType: "admin_user",
        entityId: id,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
