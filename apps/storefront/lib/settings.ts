/**
 * Platform mode settings for SnehaVrinda Kala admin.
 *
 * Two modes:
 *   - "platform"     — Multi-vendor marketplace. SnehaVrinda Kala hosts
 *                      multiple artists/partners who each manage their own
 *                      listings.
 *   - "single-brand" — Single-seller store. SnehaVrinda Kala IS the seller.
 *                      Admin manages all products, orders, and brand settings
 *                      directly. Partner management is hidden.
 *
 * Persisted in .env via PLATFORM_MODE. The admin settings page can toggle
 * between modes (writes to .env at runtime).
 */

import fs from "fs";
import path from "path";

export type PlatformMode = "platform" | "single-brand";

const ENV_PATH = path.resolve(process.cwd(), ".env");

export function getPlatformModeFromEnv(): PlatformMode {
  const raw =
    process.env.PLATFORM_MODE ||
    process.env.NEXT_PUBLIC_PLATFORM_MODE ||
    "single-brand";
  return raw === "platform" ? "platform" : "single-brand";
}

export function isPlatformMode(): boolean {
  return getPlatformModeFromEnv() === "platform";
}

export function isSingleBrandMode(): boolean {
  return getPlatformModeFromEnv() === "single-brand";
}

export const MODE_LABELS: Record<PlatformMode, string> = {
  platform: "Multi-vendor platform",
  "single-brand": "Single brand (SnehaVrinda Kala)",
};

export const MODE_DESCRIPTIONS: Record<PlatformMode, string> = {
  platform:
    "SnehaVrinda Kala hosts multiple artists and partners. Each partner manages their own listings and can be enabled/disabled individually.",
  "single-brand":
    "SnehaVrinda Kala is the sole seller. Admin manages all products, orders, and brand settings directly. Partner management is hidden.",
};

/**
 * Persist the platform mode to .env so it survives restarts.
 */
export async function setPlatformMode(mode: PlatformMode): Promise<void> {
  if (!fs.existsSync(ENV_PATH)) return;
  let envContent = fs.readFileSync(ENV_PATH, "utf8");
  const line = `PLATFORM_MODE=${mode}`;
  const regex = /^PLATFORM_MODE=.*$/m;
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, line);
  } else {
    envContent += `\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, envContent);
}
