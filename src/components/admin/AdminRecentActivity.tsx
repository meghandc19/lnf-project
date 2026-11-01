"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EventRow = { id: string; action: string; entityType: string; entityId: string | null; details: unknown; createdAt: Date | string; actor: { name: string; username: string | null } | null; actorId: string | null };
const reversible = new Set(["USER_BAN", "USER_RESTRICT", "USER_RESTORE", "ITEM_APPROVED", "ITEM_FLAGGED", "ITEM_BLOCKED"]);

export default function AdminRecentActivity({ events, adminId, isSuperAdmin, referenceTime }: { events: EventRow[]; adminId: string; isSuperAdmin: boolean; referenceTime: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  async function undo(entry: EventRow) {
    if (!window.confirm("Undo this admin action? This restores the prior account or report status. You can only undo within 10 minutes.")) return;
    setBusyId(entry.id); setMessage("");
    try {
      const response = await fetch("/api/admin/activity/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: entry.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "This action could not be undone.");
      setMessage(result.message ?? "Action undone."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "This action could not be undone."); }
    finally { setBusyId(""); }
  }
  return <section className="admin-audit-section" aria-labelledby="recent-admin-activity-title">
    <div className="admin-section-heading"><div><p className="eyebrow">Protected activity</p><h2 id="recent-admin-activity-title">Recent admin activity</h2><p>Account and report decisions are recorded. Eligible decisions can be undone for 10 minutes.</p></div></div>
    {events.length ? <div className="admin-activity-list">{events.map((entry) => {
      const details = entry.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? entry.details as Record<string, unknown> : {};
      const age = new Date(referenceTime).getTime() - new Date(entry.createdAt).getTime();
      const canUndo = reversible.has(entry.action) && typeof details.previousStatus === "string" && typeof details.nextStatus === "string" && age >= 0 && age <= 10 * 60 * 1000 && (isSuperAdmin || entry.actorId === adminId);
      return <article className="admin-activity-row" key={entry.id}><div><strong>{entry.action.replaceAll("_", " ")}</strong><span>{entry.actor?.username ? `@${entry.actor.username}` : entry.actor?.name ?? "System"} · {entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0, 12)}` : ""}</span><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}{canUndo ? ` · ${Math.max(0, Math.ceil((10 * 60 * 1000 - age) / 60000))} min to undo` : ""}</small></div>{canUndo && <button className="button button-outline" type="button" disabled={busyId === entry.id} onClick={() => void undo(entry)}>{busyId === entry.id ? "Undoing…" : "Undo"}</button>}</article>;
    })}</div> : <p className="admin-empty">No recent activity recorded.</p>}
    {message && <p className="auth-message" role="status">{message}</p>}
  </section>;
}
