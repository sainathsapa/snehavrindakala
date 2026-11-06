"use client";

import React from "react";
import { toggleArtistStatus } from "./actions";

export function ToggleArtistButton({
  id,
  enabled,
  name,
}: {
  id: string;
  enabled: boolean;
  name: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleToggle = async () => {
    setPending(true);
    setResult(null);
    const res = await toggleArtistStatus(id, !enabled);
    setResult(res);
    setPending(false);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleToggle}
        disabled={pending}
        className={`w-full py-2 px-4 rounded-md text-sm font-medium font-sans transition-colors disabled:opacity-50 ${
          enabled
            ? "bg-sindoor text-rang-paper hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2"
            : "bg-leaf text-rang-paper hover:bg-leaf/90 focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2"
        }`}
      >
        {pending
          ? enabled
            ? "Disabling…"
            : "Enabling…"
          : enabled
            ? "Disable partner"
            : "Enable partner"}
      </button>
      {result && (
        <p
          className={`text-xs font-sans ${
            result.ok ? "text-leaf" : "text-sindoor"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
