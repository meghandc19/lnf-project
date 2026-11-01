"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  name: string;
  username: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN" | "REVOK_STEWARD";
  status: "ACTIVE" | "RESTRICTED" | "BANNED" | "DELETED";
  createdAt: Date;
};

type UserDetail = {
  image: string | null;
  phoneNumber: string | null;
  role: string;
  status: string;
  createdAt: string;
  _count: { claims: number; lostItems: number; foundItems: number; sentReportMessages: number; ownedReportMessages: number };
  lostItems: Array<{ id: string; title: string; status: string; moderation: string; createdAt: string; deletedAt: string | null; _count: { claims: number } }>;
  foundItems: Array<{ id: string; title: string; status: string; moderation: string; createdAt: string; deletedAt: string | null; _count: { claims: number } }>;
};

export default function AdminUserManagement({ users, isSuperAdmin, actorEmail, initialStatus = "ALL" }: { users: UserRow[]; isSuperAdmin: boolean; actorEmail?: string; initialStatus?: string }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("joined-newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(users.length);
  const [visibleUsers, setVisibleUsers] = useState(users);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [detailsByUserId, setDetailsByUserId] = useState<Record<string, UserDetail>>({});
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      params.set("page", String(page)); params.set("sort", sortBy);
      try {
        const response = await fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load matching accounts.");
        const result = await response.json();
        setVisibleUsers(result.users); setTotalPages(result.totalPages ?? 1); setTotalUsers(result.total ?? result.users.length);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Could not load matching accounts.");
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, statusFilter, roleFilter, reloadKey, page, sortBy]);
  const filtered = visibleUsers;

  async function toggleDetails(user: UserRow) {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(user.id);
    if (detailsByUserId[user.id]) return;
    setLoadingDetailsId(user.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Could not load account details.");
      setDetailsByUserId((details) => ({ ...details, [user.id]: result.user }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load account details.");
      setExpandedUserId(null);
    } finally {
      setLoadingDetailsId(null);
    }
  }

  async function updateUser(user: UserRow, action: string) {
    const transfer = action === "TRANSFER_SUPER_ADMIN";
    const permanentDelete = action === "DELETE";
    const label = action === "ADMIN" ? "promote this account to Admin" : action === "USER" ? "remove this Admin role" : action.toLowerCase();
    if (transfer) {
      if (window.prompt(`To transfer Super Admin ownership to ${user.name}, type TRANSFER SUPER ADMIN.`) !== "TRANSFER SUPER ADMIN") return;
      if (window.prompt("Enter your signed-in email to confirm this transfer.")?.trim().toLowerCase() !== actorEmail?.trim().toLowerCase()) return;
    } else if (permanentDelete) {
      if (!window.confirm(`Permanently remove ${user.name}? Existing item reports and related account data will also be removed according to REVOK's deletion rules.`)) return;
      if (window.prompt("Type DELETE ACCOUNT to confirm permanent removal.") !== "DELETE ACCOUNT") return;
    } else if (!window.confirm(`Are you sure you want to ${label} for ${user.name}?`)) return;
    setBusyId(user.id);
    setMessage("");
    try {
      const isTransfer = transfer;
      const isSteward = action === "STEWARD" || action === "USER_STEWARD";
      const isRole = action === "ADMIN" || action === "USER";
      const response = await fetch(isTransfer ? "/api/admin/super-admin/transfer" : isSteward ? "/api/admin/stewards" : isRole ? `/api/admin/users/${user.id}/role` : `/api/admin/users/${user.id}`, {
        method: isTransfer ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isTransfer ? { targetUserId: user.id, confirmEmail: actorEmail, confirmPhrase: "TRANSFER SUPER ADMIN" } : isSteward ? { userId: user.id, assign: action === "STEWARD" } : isRole ? { role: action } : { action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "The request failed.");
      setMessage("Account updated.");
      setReloadKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request failed.");
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <div className="admin-user-filters">
      <label>Search accounts<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name or username" /></label>
      <label>Account status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="ALL">All statuses</option><option>ACTIVE</option><option>RESTRICTED</option><option>BANNED</option><option>DELETED</option></select></label>
      <label>Role<select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="ALL">All roles</option><option value="USER">User</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super Admin</option><option value="REVOK_STEWARD">REVOK Steward</option></select></label>
      <label>Sort by<select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }}><option value="joined-newest">Date joined · newest</option><option value="joined-oldest">Date joined · oldest</option><option value="name">Name</option><option value="username">Username</option></select></label>
    </div>
    <p className="admin-list-summary">{totalUsers.toLocaleString()} accounts · page {page} of {totalPages}</p>
    <p role="status" aria-live="polite" className="admin-action-message">{message}</p>
    <div className="admin-table-wrap">
      {filtered.length === 0 ? <p className="admin-empty">No accounts match those filters.</p> : <table className="admin-table">
        <caption className="visually-hidden">REVOK user accounts and available account actions</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Actions</th></tr></thead>
        <tbody>{filtered.map((user) => <Fragment key={user.id}>
          <tr key={user.id}>
          <td>{user.name}</td><td>{user.username ? `@${user.username}` : "—"}</td><td>{user.role.replace("_", " ")}</td><td><span className={`table-status status-${user.status.toLowerCase()}`}>{user.status}</span></td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.createdAt))}</td>
          <td><div className="admin-user-actions">
            <button className="button button-outline" type="button" aria-expanded={expandedUserId === user.id} onClick={() => void toggleDetails(user)}>{expandedUserId === user.id ? "Hide details" : "View details"}</button>
            {user.role !== "SUPER_ADMIN" && user.status !== "DELETED" && (user.role === "USER" || isSuperAdmin) && <>
              {user.status === "ACTIVE" ? <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "RESTRICT")}>Restrict</button> : <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "RESTORE")}>{user.status === "BANNED" ? "Unban" : user.status === "RESTRICTED" ? "Unrestrict" : "Restore"}</button>}
              {user.status !== "BANNED" && <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "BAN")}>Ban</button>}
              <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "DELETE")}>Delete</button>
              {isSuperAdmin && user.status === "ACTIVE" && user.role === "USER" && <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "ADMIN")}>Make admin</button>}
              {user.status === "ACTIVE" && (user.role === "USER" || user.role === "REVOK_STEWARD") && <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, user.role === "USER" ? "STEWARD" : "USER_STEWARD")}>{user.role === "USER" ? "Make Steward" : "Remove Steward"}</button>}
              {isSuperAdmin && user.role === "ADMIN" && <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "USER")}>Remove admin</button>}
              {isSuperAdmin && user.status === "ACTIVE" && user.role === "ADMIN" && <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "TRANSFER_SUPER_ADMIN")}>Transfer ownership</button>}
            </>}
            {isSuperAdmin && user.role === "ADMIN" && user.status === "DELETED" && <button className="button button-outline" disabled={busyId === user.id} onClick={() => updateUser(user, "USER")}>Remove admin</button>}
          </div></td>
          </tr>
          {expandedUserId === user.id && <tr key={`${user.id}-details`}><td colSpan={6}>
            {loadingDetailsId === user.id ? <p>Loading account details…</p> : detailsByUserId[user.id] ? <div className="admin-account-details">
              <div className="admin-user-detail-heading">{detailsByUserId[user.id].image && <Image src={detailsByUserId[user.id].image!} width={52} height={52} alt="" unoptimized referrerPolicy="no-referrer" />}<div><strong>{user.name}</strong><span>{user.username ? `@${user.username}` : "No username"} · {detailsByUserId[user.id].role.replaceAll("_", " ")} · {detailsByUserId[user.id].status}</span><small>Joined {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(detailsByUserId[user.id].createdAt))}</small></div></div>
              <p><strong>Phone number:</strong> {detailsByUserId[user.id].phoneNumber ?? "Not provided"}</p>
              <p><strong>Lost reports:</strong> {detailsByUserId[user.id]._count.lostItems} <strong>Found reports:</strong> {detailsByUserId[user.id]._count.foundItems} <strong>Claims:</strong> {detailsByUserId[user.id]._count.claims} <strong>Private messages:</strong> {detailsByUserId[user.id]._count.sentReportMessages} sent · {detailsByUserId[user.id]._count.ownedReportMessages} received</p>
              {([ ["Lost reports", detailsByUserId[user.id].lostItems], ["Found reports", detailsByUserId[user.id].foundItems] ] as const).map(([heading, reports]) => <section key={heading}>
                <h3>{heading}</h3>
                {reports.length ? <ul>{reports.map((report) => <li key={report.id}>
                  <strong>{report.title}</strong> · {report.status.replaceAll("_", " ")} · {report.moderation.toLowerCase()} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(report.createdAt))} · {report._count.claims} claims{report.deletedAt ? " · deleted" : ""}
                </li>)}</ul> : <p>No reports.</p>}
              </section>)}
            </div> : null}
          </td></tr>}
        </Fragment>)}</tbody>
      </table>}
    </div>
    {totalPages > 1 && <nav className="admin-pagination" aria-label="Account pages"><button className="button button-outline" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="button button-outline" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
  </>;
}
