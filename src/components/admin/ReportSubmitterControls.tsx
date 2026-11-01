"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ManagedRole = "USER" | "ADMIN" | "SUPER_ADMIN" | "REVOK_STEWARD";
type ManagedStatus = "ACTIVE" | "RESTRICTED" | "BANNED" | "DELETED";
type AccountAction = "RESTRICT" | "BAN" | "RESTORE" | "DELETE" | "ADMIN" | "USER" | "STEWARD" | "REMOVE_STEWARD";

type Submitter = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  phoneNumber: string | null;
  role: ManagedRole;
  status: ManagedStatus;
  emailVerified: boolean;
  phoneNumberVerified: boolean;
};
type AccountSummary = { image: string | null; phoneNumber: string | null; role: string; status: string; createdAt: string; _count: { claims: number; lostItems: number; foundItems: number; sentReportMessages: number; ownedReportMessages: number }; lostItems: Array<{ id: string; title: string; status: string; moderation: string; createdAt: string; _count: { claims: number } }>; foundItems: Array<{ id: string; title: string; status: string; moderation: string; createdAt: string; _count: { claims: number } }> };

export default function ReportSubmitterControls({ user, actorRole }: { user: Submitter; actorRole: ManagedRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const canManage = user.role !== "SUPER_ADMIN" && (actorRole === "SUPER_ADMIN" || user.role === "USER");
  const canPromote = actorRole === "SUPER_ADMIN"
    && user.role === "USER"
    && user.status === "ACTIVE"
    && Boolean(user.username)
    && (user.emailVerified || user.phoneNumberVerified);

  async function updateAccount(action: AccountAction) {
    const labels: Record<AccountAction, string> = {
      RESTRICT: "restrict",
      BAN: "ban",
      RESTORE: "restore",
      DELETE: "permanently delete",
      ADMIN: "make an Admin",
      USER: "remove Admin access from",
      STEWARD: "assign the Steward role to",
      REMOVE_STEWARD: "remove the Steward role from",
    };
    const subject = action === "USER" ? `remove Admin access from ${user.name}` : `${labels[action]} ${user.name}`;
    if (!window.confirm(`Are you sure you want to ${subject}?`)) return;
    if (action === "DELETE" && window.prompt("Type DELETE ACCOUNT to confirm permanent removal.") !== "DELETE ACCOUNT") return;

    setBusy(true);
    setMessage("");
    const isRoleChange = action === "ADMIN" || action === "USER";
    const isStewardChange = action === "STEWARD" || action === "REMOVE_STEWARD";
    try {
      const response = await fetch(isStewardChange ? "/api/admin/stewards" : isRoleChange ? `/api/admin/users/${encodeURIComponent(user.id)}/role` : `/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isStewardChange ? { userId: user.id, assign: action === "STEWARD" } : isRoleChange ? { role: action } : { action, reason: "Action taken from the report review queue." }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? result.error ?? "The account action could not be saved.");
        return;
      }
      setMessage(action === "DELETE" ? "Account deleted." : "Account updated.");
      if (action === "DELETE") setOpen(false);
      router.refresh();
    } catch {
      setMessage("Could not reach REVOK. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "R";

  async function toggleProfile() {
    const next = !open;
    setOpen(next); setMessage("");
    if (!next || summary || loadingSummary) return;
    setLoadingSummary(true);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Could not load account summary.");
      setSummary(result.user);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load account summary."); }
    finally { setLoadingSummary(false); }
  }

  return (
    <section className="admin-report-submitter" aria-label="Report submitter">
      <div className="admin-report-submitter-identity">
        <button className="admin-report-submitter-avatar" type="button" aria-label={`View and manage ${user.name}'s account`} aria-expanded={open} onClick={() => void toggleProfile()}>
          {user.image ? <Image src={user.image} width={52} height={52} alt="" unoptimized /> : <span>{initials}</span>}
        </button>
        <div className="admin-report-submitter-copy">
          <strong>{user.name}</strong>
          <span>{user.username ? `@${user.username}` : "Username not set"}</span>
          <span>Phone: {user.phoneNumber ?? "Not provided"}</span>
        </div>
        <span className="admin-report-submitter-role">{user.role.replaceAll("_", " ")}</span>
      </div>
      {open && (
        <div className="admin-report-submitter-actions">
          <p>Account status: <strong>{user.status}</strong></p>
          {loadingSummary ? <p role="status">Loading account summary…</p> : summary && <div className="admin-account-summary"><div className="admin-user-detail-heading">{summary.image && <Image src={summary.image} width={52} height={52} alt="" unoptimized referrerPolicy="no-referrer" />}<div><strong>{user.name}</strong><span>{user.username ? `@${user.username}` : "No username"} · {summary.role.replaceAll("_", " ")} · {summary.status}</span><small>Joined {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(summary.createdAt))}</small></div></div><p><strong>Phone:</strong> {summary.phoneNumber ?? "Not provided"}</p><p><strong>Lost:</strong> {summary._count.lostItems} · <strong>Found:</strong> {summary._count.foundItems} · <strong>Claims:</strong> {summary._count.claims} · <strong>Private messages:</strong> {summary._count.sentReportMessages} sent / {summary._count.ownedReportMessages} received</p>{[ ["Lost reports", summary.lostItems], ["Found reports", summary.foundItems] ].map(([heading, reports]) => <section key={heading as string}><h4>{heading as string}</h4>{(reports as AccountSummary["lostItems"]).length ? <ul>{(reports as AccountSummary["lostItems"]).map((report) => <li key={report.id}>{report.title} · {report.moderation.toLowerCase()} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(report.createdAt))} · {report._count.claims} claims</li>)}</ul> : <small>No reports.</small>}</section>)}</div>}
          {canManage && user.status !== "DELETED" && (
            <div className="button-row">
              {user.status !== "BANNED" && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("BAN")}>Ban account</button>}
              {user.status === "ACTIVE" && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("RESTRICT")}>Restrict account</button>}
              {(user.status === "BANNED" || user.status === "RESTRICTED") && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("RESTORE")}>Restore account</button>}
              <button className="button button-danger" type="button" disabled={busy} onClick={() => void updateAccount("DELETE")}>Delete account</button>
              {user.status === "ACTIVE" && user.role === "USER" && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("STEWARD")}>Make Steward</button>}
              {user.status === "ACTIVE" && user.role === "REVOK_STEWARD" && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("REMOVE_STEWARD")}>Remove Steward</button>}
              {canPromote && <button className="button button-primary" type="button" disabled={busy} onClick={() => void updateAccount("ADMIN")}>Make admin</button>}
              {actorRole === "SUPER_ADMIN" && user.role === "ADMIN" && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("USER")}>Remove admin</button>}
            </div>
          )}
          {!canManage && <p>{user.role === "SUPER_ADMIN" ? "Super Admin accounts are protected." : "Only a Super Admin can manage this Admin account."}</p>}
          {actorRole === "ADMIN" && user.role === "USER" && <p>Only a Super Admin can promote an account to Admin.</p>}
          {actorRole === "SUPER_ADMIN" && user.role === "USER" && !canPromote && user.status !== "DELETED" && <p>This account needs an active status, username, and verified email or phone before it can become an Admin.</p>}
          {message && <p role="status" aria-live="polite">{message}</p>}
        </div>
      )}
    </section>
  );
}
