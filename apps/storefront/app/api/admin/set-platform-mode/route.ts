import { NextResponse } from "next/server";
import {
  getAdminIdentity,
  requirePermission,
} from "@/app/admin/actions";
import { recordAdminAction } from "@/lib/audit";
import { correlationIdFrom } from "@/lib/partner-audit/audit";
import {
  getPlatformModeFromEnv,
  setPlatformMode,
} from "@/lib/settings";

export async function POST(req: Request) {
  if (!(await requirePermission("settings:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { mode } = await req.json();
  const validMode = mode === "platform" ? "platform" : "single-brand";
  const previousMode = getPlatformModeFromEnv();
  await setPlatformMode(validMode);
  // A108: the platform mode switch is a critical config change and is now
  // attributable to the signed-in admin with a before/after value.
  await recordAdminAction({
    actorEmail: identity.email,
    actorRole: identity.role,
    action: "platform_mode.changed",
    entityType: "platform_settings",
    entityId: "platform_mode",
    oldValues: { mode: previousMode },
    newValues: {
      mode: validMode,
      requestId: correlationIdFrom(req),
      result: "success",
    },
  });
  return NextResponse.json({ ok: true });
}
