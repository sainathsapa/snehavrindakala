/**
 * GET /api/notifications - SSE stream for real-time notifications
 * POST /api/notifications - Create a notification
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://medusa:medusa@localhost:5432/medusa";

async function query(sql: string, params: any[] = []) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
    pool.end();
  }
}

// In-memory SSE clients (in production, use Redis pub/sub)
const clients: Map<string, any> = new Map();

export async function GET(req: Request) {
  await requireAdmin();
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    // Table may already exist
  }

  const { searchParams } = new URL(req.url);
  const userEmail = searchParams.get("user") || "admin";

  const stream = new ReadableStream({
    start(controller) {
      const clientId = crypto.randomUUID();
      clients.set(clientId, controller);

      // Send existing notifications
      query(
        "SELECT * FROM notifications WHERE user_email = $1 OR user_email IS NULL ORDER BY created_at DESC LIMIT 50",
        [userEmail]
      ).then((rows: any[]) => {
        controller.enqueue(
          `data: ${JSON.stringify({ type: "init", notifications: rows })}\n\n`
        );
      });

      // Heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
      }, 30000);

      return () => {
        clients.delete(clientId);
        clearInterval(heartbeat);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const body = await req.json();
    const { user_email, title, message, type } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message required" },
        { status: 400 }
      );
    }

    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { v4: uuidv4 } = require("uuid");
    const id = `notif_${uuidv4().slice(0, 8)}`;

    await query(
      `INSERT INTO notifications (id, user_email, title, message, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING *`,
      [id, user_email || null, title, message, type || "info"]
    );

    // Broadcast to SSE clients
    const notification = { id, user_email, title, message, type: type || "info", created_at: new Date().toISOString() };
    clients.forEach((controller) => {
      try {
        controller.enqueue(`data: ${JSON.stringify(notification)}\n\n`);
      } catch {
        // Client may be disconnected
      }
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
