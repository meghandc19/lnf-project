import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/auth/LogoutButton";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import AdminUserManagement from "@/components/admin/AdminUserManagement";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [totalUsers, activeUsers, restrictedUsers, bannedUsers, deletedRecords, lostReports, foundReports, pendingLost, pendingFound, recentUsers, auditEvents] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "RESTRICTED" } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.userDeletionRecord.count(),
    prisma.lostItem.count({ where: { deletedAt: null } }),
    prisma.foundItem.count({ where: { deletedAt: null } }),
    prisma.lostItem.count({ where: { deletedAt: null, moderation: { in: ["PENDING", "FLAGGED"] } } }),
    prisma.foundItem.count({ where: { deletedAt: null, moderation: { in: ["PENDING", "FLAGGED"] } } }),
    prisma.user.findMany({ select: { id: true, name: true, username: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    admin.role === "SUPER_ADMIN" ? prisma.auditLog.findMany({ where: { OR: [{ action: { startsWith: "USER_" } }, { action: { startsWith: "ITEM_" } }, { action: "INITIAL_SUPER_ADMIN_BOOTSTRAPPED" }, { action: "BOOTSTRAP_REMOVE_ADMIN_ROLE" }, { action: "SUPER_ADMIN_TRANSFER" }, { action: "CONFIGURED_SUPER_ADMIN_OWNER_SET" }] }, select: { id: true, action: true, entityType: true, entityId: true, details: true, createdAt: true, actor: { select: { name: true, username: true } } }, orderBy: { createdAt: "desc" }, take: 10 }) : Promise.resolve([]),
  ]);
  const pendingReports = pendingLost + pendingFound;

  return <div className="site-page">
    <SiteHeader />
    <main className="admin-main page-width">
      <div className="admin-heading">
        <div><p className="eyebrow">REVOK administration</p><h1>Welcome, {admin.name}.</h1><p>Account access, report review, and recent security activity.</p></div>
        <div className="admin-heading-actions"><span className="status-chip">{admin.role.replace("_", " ")}</span><LogoutButton /></div>
      </div>

      <section className="admin-metrics" aria-label="Administration overview">
        {[["Registered users", totalUsers], ["Active", activeUsers], ["Restricted", restrictedUsers], ["Banned", bannedUsers], ["Deleted records", deletedRecords], ["Lost reports", lostReports], ["Found reports", foundReports], ["Needs review", pendingReports]].map(([label, count]) => <article className="admin-metric" key={label}><span>{label}</span><strong>{count}</strong></article>)}
      </section>

      <div className="admin-section-heading">
        <div><h2>User management</h2><p>Search accounts, review phone and report summaries, and manage account access.</p></div>
        <Link href="/admin/reports" className="button button-primary">Review reports{pendingReports ? ` (${pendingReports})` : ""}</Link>
      </div>
      <AdminUserManagement users={recentUsers} isSuperAdmin={admin.role === "SUPER_ADMIN"} actorEmail={admin.role === "SUPER_ADMIN" ? admin.email : undefined} />

      {admin.role === "SUPER_ADMIN" && <section className="admin-audit-section">
        <div className="admin-section-heading"><div><p className="eyebrow">Protected activity</p><h2>Recent admin activity</h2><p>Latest account, role, and report moderation actions recorded by the server.</p></div></div>
        {auditEvents.length === 0 ? <p className="admin-empty">No account security events have been recorded yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><caption className="visually-hidden">Recent account security events</caption><thead><tr><th>Action</th><th>Performed by</th><th>Target reference</th><th>Time</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><td>{event.action.replaceAll("_", " ")}</td><td>{event.actor?.username ? `@${event.actor.username}` : event.actor?.name ?? "System"}</td><td>{event.entityType} · {event.entityId ? `${event.entityId.slice(0, 8)}…` : "—"}</td><td>{dateFormatter.format(event.createdAt)}</td></tr>)}</tbody></table></div>}
      </section>}
      <div className="admin-note"><strong>Security status:</strong> {restrictedUsers + bannedUsers} accounts are currently restricted or banned. <Link href="/admin/reports" className="text-link">Open moderation queue →</Link></div>
    </main>
    <SiteFooter />
  </div>;
}
