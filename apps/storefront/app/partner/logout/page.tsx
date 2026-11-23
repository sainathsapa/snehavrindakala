"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PartnerLogoutPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/partner/auth/logout", { method: "POST" })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (!active) return;
        router.replace("/partner/login");
        router.refresh();
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-rang-paper px-4">
      <div className="w-full max-w-md rounded-xl border border-sand-border bg-surface p-8 text-center shadow-lg">
        <h1 className="text-2xl font-serif font-semibold text-deep-ink">
          Signing out…
        </h1>
        <p className="mt-3 text-sm font-sans text-muted-ink">
          {failed
            ? "Your session cookie could not be cleared automatically. Please close this browser window and sign in again."
            : "Clearing your partner session."}
        </p>
        <Link
          href="/partner/login"
          className="mt-6 inline-block text-sm font-sans font-medium text-sindoor hover:underline"
        >
          Return to sign in
        </Link>
      </div>
    </main>
  );
}
