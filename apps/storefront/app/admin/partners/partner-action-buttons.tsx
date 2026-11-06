"use client";

import { useState } from "react";
import { toggleArtistStatusAction, deleteArtist } from "../actions";

interface PartnerActionButtonsProps {
  artistId: string;
  isApproved: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export function PartnerActionButtons({
  artistId,
  isApproved,
  canWrite,
  canDelete,
}: PartnerActionButtonsProps) {
  const [pending, setPending] = useState<string | null>(null);

  const handleToggle = async () => {
    setPending("toggle");
    try {
      await toggleArtistStatusAction(artistId, !isApproved);
      setPending(null);
      window.location.href = "/admin/partners?toggled=1";
    } catch {
      setPending(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove this partner?")) return;
    setPending("delete");
    try {
      await deleteArtist(artistId);
      setPending(null);
      window.location.href = "/admin/partners?deleted=1";
    } catch {
      setPending(null);
    }
  };

  return (
    <div className="flex gap-2">
      {canWrite && (
        <button
          onClick={handleToggle}
          disabled={pending === "toggle"}
          className={`text-xs font-medium px-3 py-1 rounded-md transition-colors disabled:opacity-50 ${
            pending === "toggle" ? "opacity-50" : isApproved
              ? "bg-sindoor/10 text-sindoor hover:bg-sindoor/20"
              : "bg-leaf/10 text-leaf hover:bg-leaf/20"
          }`}
        >
          {pending === "toggle" ? "…" : isApproved ? "Suspend" : "Enable"}
        </button>
      )}
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={pending === "delete"}
          className="text-xs font-medium text-sindoor hover:underline disabled:opacity-50"
        >
          {pending === "delete" ? "…" : "Remove"}
        </button>
      )}
    </div>
  );
}
