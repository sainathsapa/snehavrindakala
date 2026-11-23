"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface MemberView {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  last_login_at: string;
}

const ROLES = ["viewer", "finance", "operations", "manager", "owner"];

export default function TeamClient({
  initialMembers,
  currentMemberId,
  canWrite,
}: {
  initialMembers: MemberView[];
  currentMemberId: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("viewer");
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function readError(res: Response, fallback: string) {
    const data = await res.json().catch(() => ({}));
    return !res.ok || !data.ok ? data.error || fallback : "";
  }

  async function refreshMembers() {
    const res = await fetch("/api/partner/team", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.members)) setMembers(data.members);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTempPassword("");
    setBusyId("invite");
    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // partner_id is intentionally absent: the server derives it from session.
        body: JSON.stringify({ email, fullName, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not send the invite.");
      } else {
        setTempPassword(data.tempPassword || "");
        setEmail("");
        setFullName("");
        await refreshMembers();
      }
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function mutate(id: string, init: RequestInit, fallback: string) {
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/partner/team/${encodeURIComponent(id)}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const message = await readError(res, fallback);
      if (message) {
        setError(message);
      } else {
        await refreshMembers();
        router.refresh();
      }
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="rounded-md border border-sindoor/20 bg-sindoor/10 p-3 text-sm font-sans text-sindoor">
          {error}
        </div>
      )}

      {canWrite && (
        <section className="rounded-xl border border-sand-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-serif font-semibold text-deep-ink">
            Invite a member
          </h2>
          <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-4 sm:items-end">
            <div>
              <label htmlFor="invite-email" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label htmlFor="invite-name" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
                Full name
              </label>
              <input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-2 block text-sm font-sans font-medium text-deep-ink">
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm font-sans text-deep-ink focus:ring-2 focus:ring-sindoor"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busyId === "invite"}
              className="rounded-xl bg-sindoor px-4 py-2.5 font-sans font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 disabled:opacity-50"
            >
              {busyId === "invite" ? "Inviting…" : "Invite"}
            </button>
          </form>
          {tempPassword && (
            <div role="status" className="mt-4 rounded-md border border-sand-border bg-rang-paper p-4 text-sm font-sans text-deep-ink">
              <p className="font-medium">Invite created. Copy this temporary password now — it is shown once.</p>
              <code className="mt-2 block break-all rounded bg-surface p-2">{tempPassword}</code>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-sand-border bg-surface shadow-sm">
        <h2 className="border-b border-sand-border px-6 py-4 text-xl font-serif font-semibold text-deep-ink">
          Members
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-sans text-deep-ink">
            <thead className="bg-rang-paper text-xs uppercase tracking-wide text-muted-ink">
              <tr>
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Last login</th>
                {canWrite && <th className="px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium">{member.full_name || "—"}</div>
                    <div className="text-xs text-muted-ink">{member.email}</div>
                    {member.id === currentMemberId && (
                      <div className="text-xs text-sindoor">You</div>
                    )}
                  </td>
                  <td className="px-6 py-4 capitalize">{member.role}</td>
                  <td className="px-6 py-4 capitalize">{member.status}</td>
                  <td className="px-6 py-4 text-muted-ink">
                    {member.last_login_at
                      ? new Date(member.last_login_at).toLocaleString()
                      : "Never"}
                  </td>
                  {canWrite && (
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <RoleControl
                          member={member}
                          disabled={busyId === member.id || member.id === currentMemberId}
                          onSave={(newRole) =>
                            mutate(
                              member.id,
                              {
                                method: "PATCH",
                                body: JSON.stringify({ role: newRole }),
                              },
                              "Could not change the role."
                            )
                          }
                        />
                        <button
                          type="button"
                          disabled={busyId === member.id || member.status === "suspended"}
                          onClick={() =>
                            mutate(
                              member.id,
                              { method: "POST", body: "{}" },
                              "Could not revoke sessions."
                            )
                          }
                          className="rounded-md border border-sand-border px-2 py-1 text-xs font-sans text-deep-ink hover:bg-rang-paper disabled:opacity-50"
                        >
                          Revoke sessions
                        </button>
                        <button
                          type="button"
                          disabled={busyId === member.id || member.status === "suspended"}
                          onClick={() =>
                            mutate(
                              member.id,
                              { method: "DELETE" },
                              "Could not suspend the member."
                            )
                          }
                          className="rounded-md border border-sindoor/30 px-2 py-1 text-xs font-sans text-sindoor hover:bg-sindoor/10 disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RoleControl({
  member,
  disabled,
  onSave,
}: {
  member: MemberView;
  disabled: boolean;
  onSave: (role: string) => void;
}) {
  const [value, setValue] = useState(member.role);
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={`Role for ${member.email}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-sand-border bg-surface px-2 py-1 text-xs font-sans text-deep-ink disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled || value === member.role}
        onClick={() => onSave(value)}
        className="rounded-md border border-sand-border px-2 py-1 text-xs font-sans text-deep-ink hover:bg-rang-paper disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
