"use client";

/**
 * Publishing a studio update.
 *
 * The photograph is optional and uploaded first, because a milestone with a
 * half-finished upload is worse than one without a picture: the buyer would see a
 * broken frame where the work should be.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StudioUpdateForm({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("upload failed");
    const body = (await res.json()) as { url?: string };
    return body.url || "";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/commissions/${commissionId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, proof_url: proofUrl }),
      });
      if (!res.ok) {
        setError("The update needs a short title.");
        return;
      }
      setName("");
      setDescription("");
      setProofUrl("");
      router.refresh();
    } catch {
      setError("Could not publish that just now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-dashed border-sand-border p-4">
      <p className="font-sans text-xs font-semibold uppercase tracking-wider text-terracotta">
        Publish an update
      </p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ground laid and paper sized"
        required
        className="rounded border border-sand-border bg-white px-3 py-2 font-sans text-sm"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        placeholder="What happened, in the studio's own words. This is what the buyer reads."
        className="rounded border border-sand-border bg-white px-3 py-2 font-sans text-sm"
      />
      <label className="font-sans text-xs text-muted-ink">
        Photograph (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              setProofUrl(await upload(file));
            } catch {
              setError("The photograph could not be uploaded. The update can still be published without it.");
            } finally {
              setBusy(false);
            }
          }}
          className="mt-1 block w-full font-sans text-xs"
        />
      </label>
      {proofUrl && (
        <p className="font-sans text-xs text-muted-ink">
          Photograph attached: <code>{proofUrl}</code>
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-ink/20 px-4 py-2 font-sans text-[11px] uppercase tracking-wider text-ink hover:border-terracotta hover:text-terracotta disabled:opacity-50"
        >
          {busy ? "Saving…" : "Publish"}
        </button>
        {error && <span className="font-sans text-xs text-[#8a2c14]">{error}</span>}
      </div>
    </form>
  );
}
