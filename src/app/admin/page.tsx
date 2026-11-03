import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/auth/LogoutButton";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import AdminUserManagement from "@/components/admin/AdminUserManagement";
import StewardManagement from "@/components/admin/StewardManagement";
import UserReportDecision from "@/components/admin/UserReportDecision";
import ReportSubmitterControls from "@/components/admin/ReportSubmitterControls";
import AdminRecentActivity from "@/components/admin/AdminRecentActivity";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const submitterSelection = { id: true, name: true, username: true, image: true, phoneNumber: true, role: true, status: true, emailVerified: true, phoneNumberVerified: true } as const;

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const admin = await requireAdmin();
  const requestedView = (await searchParams)?.view ?? "home";
  const view = ["home", "users", "restricted", "banned", "needs-review", "claims", "stewards"].includes(requestedView) ? requestedView : "home";
  const [totalUsers, restrictedUsers, bannedUsers, lostReports, foundReports, pendingLost, pendingFound, unresolvedUserReports, activity, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "RESTRICTED" } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.lostItem.count({ where: { deletedAt: null } }),
    prisma.foundItem.count({ where: { deletedAt: null } }),
    prisma.lostItem.count({ where: { deletedAt: null, moderation: { in: ["PENDING", "FLAGGED"] } } }),
    prisma.foundItem.count({ where: { deletedAt: null, moderation: { in: ["PENDING", "FLAGGED"] } } }),
    prisma.userReport.count({ where: { adminDecision: null } }),
    prisma.auditLog.findMany({ where: { OR: [{ action: { startsWith: "USER_" } }, { action: { startsWith: "ITEM_" } }, { action: { startsWith: "STEWARD_" } }, { action: "ADMIN_ACTION_UNDONE" }, { action: "CLAIM_DISPUTE_REVIEWED" }, { action: "INITIAL_SUPER_ADMIN_BOOTSTRAPPED" }, { action: "BOOTSTRAP_REMOVE_ADMIN_ROLE" }, { action: "SUPER_ADMIN_TRANSFER" }, { action: "CONFIGURED_SUPER_ADMIN_OWNER_SET" }] }, select: { id: true, action: true, entityType: true, entityId: true, actorId: true, details: true, createdAt: true, actor: { select: { name: true, username: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    view === "users" || view === "restricted" || view === "banned" ? prisma.user.findMany({ where: view === "restricted" ? { status: "RESTRICTED" } : view === "banned" ? { status: "BANNED" } : {}, select: { id: true, name: true, username: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
  ]);
  const [claimCases, handovers, allClaims] = view === "needs-review" || view === "claims" ? await Promise.all([
    prisma.userReport.findMany({ where: view === "needs-review" ? { adminDecision: null } : {}, orderBy: { createdAt: "desc" }, take: 100, include: { reporter: { select: submitterSelection }, reportedUser: { select: submitterSelection }, claim: { select: { id: true, status: true, createdAt: true } }, foundItem: { select: { id: true, title: true, custodyStatus: true } } } }),
    view === "claims" ? prisma.handoverRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { foundItem: { select: { title: true, custodyStatus: true } }, finder: { select: { name: true, username: true } }, steward: { select: { name: true, username: true } } } }) : Promise.resolve([]),
    view === "claims" ? prisma.claim.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, status: true, createdAt: true, updatedAt: true, recoveredAt: true, recoveryCodeExpiresAt: true, recoveryCodeAttempts: true, user: { select: { name: true, username: true } }, foundItem: { select: { id: true, title: true, custodyStatus: true, user: { select: { name: true, username: true } }, custodian: { select: { name: true, username: true } } } } } }) : Promise.resolve([]),
  ]) : [[], [], []];
  const selectedStatus = view === "restricted" ? "RESTRICTED" : view === "banned" ? "BANNED" : "ALL";
  const metrics = [
    { label: "Registered users", count: totalUsers, href: "/admin?view=users", view: "users" },
    { label: "Restricted", count: restrictedUsers, href: "/admin?view=restricted", view: "restricted" },
    { label: "Banned", count: bannedUsers, href: "/admin?view=banned", view: "banned" },
    { label: "Lost reports", count: lostReports, href: "/admin/reports?type=LOST&mode=all", view: "lost" },
    { label: "Found reports", count: foundReports, href: "/admin/reports?type=FOUND&mode=all", view: "found" },
    { label: "Needs review", count: unresolvedUserReports, href: "/admin?view=needs-review", view: "needs-review" },
    { label: "Lost awaiting review", count: pendingLost, href: "/admin/reports?type=LOST&mode=pending", view: "lost-pending" },
    { label: "Found awaiting review", count: pendingFound, href: "/admin/reports?type=FOUND&mode=pending", view: "found-pending" },
  ] as const;

  return <div className="site-page">
    <SiteHeader />
    <main className="admin-main page-width">
      <div className="admin-heading"><div><p className="eyebrow">REVOK administration</p><h1>Welcome, {admin.name}.</h1><p>Choose a count to open its management list. Decisions are logged and recent status changes can be undone for 10 minutes.</p></div><div className="admin-heading-actions"><span className="status-chip">{admin.role.replaceAll("_", " ")}</span><LogoutButton /></div></div>

      <section className="admin-metrics" aria-label="Administration overview">
        {metrics.map((metric) => <Link className={`admin-metric admin-metric-link${view === metric.view ? " is-selected" : ""}`} href={metric.href} key={metric.view}><span>{metric.label}</span><strong>{metric.count}</strong><small>Open list →</small></Link>)}
      </section>

      <nav className="admin-tools-nav" aria-label="Other administration tools"><Link className={view === "claims" ? "is-current" : ""} href="/admin?view=claims">Claims &amp; recovery</Link><Link className={view === "stewards" ? "is-current" : ""} href="/admin?view=stewards">Steward management</Link><Link href="/admin/security">Security &amp; settings</Link>{view !== "home" && <Link href="/admin">Admin overview</Link>}</nav>

      {(view === "users" || view === "restricted" || view === "banned") && <section className="admin-content-panel"><div className="admin-section-heading"><div><p className="eyebrow">Account management</p><h2>{view === "restricted" ? "Restricted users" : view === "banned" ? "Banned users" : "Registered users"}</h2><p>Search, filter, sort, inspect account details, and manage eligible accounts. Registered users includes banned and deleted accounts.</p></div></div><AdminUserManagement key={view} users={users} isSuperAdmin={admin.role === "SUPER_ADMIN"} actorEmail={admin.role === "SUPER_ADMIN" ? admin.email : undefined} initialStatus={selectedStatus} /></section>}

      {view === "needs-review" && <section className="admin-content-panel"><div className="admin-section-heading"><div><p className="eyebrow">Claim chat reports</p><h2>Reports from users</h2><p>Each report shows the reason, message, claim, and item it concerns. Review the conversation and the reported account before deciding.</p></div></div><div className="admin-review-list">{claimCases.map((caseItem) => <article key={caseItem.id}><strong>{caseItem.foundItem.title}</strong><span>Report: {caseItem.reason} · {dateFormatter.format(caseItem.createdAt)}</span><p>Reported by {caseItem.reporter.name}{caseItem.reporter.username ? ` · @${caseItem.reporter.username}` : ""} · about {caseItem.reportedUser.name}{caseItem.reportedUser.username ? ` · @${caseItem.reportedUser.username}` : ""}</p><p>{caseItem.description}</p><small>Claim {caseItem.claim.id.slice(-8)} · {caseItem.claim.status.toLowerCase()} · custody {caseItem.foundItem.custodyStatus ?? "unspecified"}</small><div className="button-row"><Link href={`/claims/${caseItem.claim.id}`} className="button button-outline">Review chat</Link><Link href={`/items/found/${caseItem.foundItem.id}`} className="button button-outline">View item</Link></div><ReportSubmitterControls user={caseItem.reporter} actorRole={admin.role} /><ReportSubmitterControls user={caseItem.reportedUser} actorRole={admin.role} /><UserReportDecision id={caseItem.id} value={caseItem.adminDecision} /></article>)}{claimCases.length === 0 && <p>No user reports need review.</p>}</div></section>}

      {view === "claims" && <section className="admin-content-panel"><div className="admin-section-heading"><div><p className="eyebrow">Private review</p><h2>Claims &amp; recovery</h2><p>Claim-linked user reports, claim status, and Steward handover history.</p></div></div><h3>Claim reports</h3><div className="admin-review-list">{claimCases.map((caseItem) => <article key={caseItem.id}><strong>{caseItem.foundItem.title}</strong><span>{caseItem.reason} · {dateFormatter.format(caseItem.createdAt)}</span><span>From {caseItem.reporter.name} about {caseItem.reportedUser.name}{caseItem.reportedUser.username ? ` · @${caseItem.reportedUser.username}` : ""}</span><p>{caseItem.description}</p><small>{caseItem.adminDecision ? `Decision: ${caseItem.adminDecision}` : "Awaiting review"}</small><Link href={`/claims/${caseItem.claim.id}`} className="button button-outline">Review chat</Link><ReportSubmitterControls user={caseItem.reportedUser} actorRole={admin.role} /><UserReportDecision id={caseItem.id} value={caseItem.adminDecision} /></article>)}{claimCases.length === 0 && <p>No claim reports have been submitted.</p>}</div><h3>Steward handovers</h3><div className="admin-review-list">{handovers.map((handover) => <article key={handover.id}><strong>{handover.foundItem.title}</strong><span>{handover.finder.name} → {handover.steward.name}</span><small>{handover.status.toLowerCase()} · {dateFormatter.format(handover.createdAt)}{handover.foundItem.custodyStatus ? ` · ${handover.foundItem.custodyStatus}` : ""}</small></article>)}{handovers.length === 0 && <p>No Steward handovers recorded.</p>}</div><h3>Claim and recovery history</h3><div className="admin-review-list">{allClaims.map((claim) => <article key={claim.id}><strong>{claim.foundItem?.title ?? "Found item"} · {claim.status.toLowerCase()}</strong><span>Finder {claim.foundItem?.user.name} · claimant {claim.user.name}{claim.user.username ? ` · @${claim.user.username}` : ""}</span><small>Claim {claim.id.slice(-8)} · {dateFormatter.format(claim.createdAt)}{claim.recoveredAt ? ` · recovered ${dateFormatter.format(claim.recoveredAt)}` : ""} · failed code attempts {claim.recoveryCodeAttempts}</small>{claim.foundItem && <Link href={`/claims/${claim.id}`} className="button button-outline">Review conversation</Link>}</article>)}{allClaims.length === 0 && <p>No claim requests yet.</p>}</div></section>}

      {view === "stewards" && <StewardManagement />}
      {view === "home" && <AdminRecentActivity events={activity} adminId={admin.id} isSuperAdmin={admin.role === "SUPER_ADMIN"} referenceTime={new Date().toISOString()} />}
      <div className="admin-note"><strong>Review queue:</strong> {pendingLost + pendingFound} item reports are awaiting moderation. <Link href="/admin/reports?type=LOST&amp;mode=pending" className="text-link">Open pending lost reports →</Link></div>
    </main>
    <SiteFooter />
  </div>;
}
