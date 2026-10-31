"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ManagedRole = "USER" | "ADMIN" | "SUPER_ADMIN";
type ManagedStatus = "ACTIVE" | "RESTRICTED" | "BANNED" | "DELETED";
type AccountAction = "RESTRICT" | "BAN" | "RESTORE" | "DELETE" | "ADMIN" | "USER";

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

export default function ReportSubmitterControls({ user, actorRole }: { user: Submitter; actorRole: ManagedRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
    };
    const subject = action === "USER" ? `remove Admin access from ${user.name}` : `${labels[action]} ${user.name}`;
    if (!window.confirm(`Are you sure you want to ${subject}?`)) return;
    if (action === "DELETE" && window.prompt("Type DELETE ACCOUNT to confirm permanent removal.") !== "DELETE ACCOUNT") return;

    setBusy(true);
    setMessage("");
    const isRoleChange = action === "ADMIN" || action === "USER";
    try {
      const response = await fetch(isRoleChange ? `/api/admin/users/${encodeURIComponent(user.id)}/role` : `/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRoleChange ? { role: action } : { action, reason: "Action taken from the report review queue." }),
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

  return (
    <section className="admin-report-submitter" aria-label="Report submitter">
      <div className="admin-report-submitter-identity">
        <button className="admin-report-submitter-avatar" type="button" aria-label={`Manage account for ${user.name}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); setMessage(""); }}>
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
          {canManage && user.status !== "DELETED" && (
            <div className="button-row">
              {user.status !== "BANNED" && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("BAN")}>Ban account</button>}
              {(user.status === "BANNED" || user.status === "RESTRICTED") && <button className="button button-outline" type="button" disabled={busy} onClick={() => void updateAccount("RESTORE")}>Restore account</button>}
              <button className="button button-danger" type="button" disabled={busy} onClick={() => void updateAccount("DELETE")}>Delete account</button>
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
