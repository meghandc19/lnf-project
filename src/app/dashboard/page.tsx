import { redirect } from "next/navigation";
import { requireCanBrowse } from "@/lib/auth/guards";
import LogoutButton from "@/components/auth/LogoutButton";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { ReportActions } from "@/components/reports/ReportManagement";

export default async function DashboardPage() {
  let user;
  try { user = await requireCanBrowse(); } catch { redirect("/login"); }
  const [lostCount, foundCount, lostReports, foundReports] = await Promise.all([
    prisma.lostItem.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.foundItem.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.lostItem.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, include: { images: true, category: true } }),
    prisma.foundItem.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, include: { images: true, category: true } }),
  ]);
  const memberMonths = Math.max(1, (new Date().getFullYear() - user.createdAt.getFullYear()) * 12 + new Date().getMonth() - user.createdAt.getMonth());
  const reports = [...lostReports.map((report) => ({ ...report, type: "LOST" as const, occurredAt: report.lostAt })), ...foundReports.map((report) => ({ ...report, type: "FOUND" as const, occurredAt: report.foundAt }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const renderReport = (report: (typeof reports)[number]) => <article className="dashboard-report-card" key={`${report.type}-${report.id}`}>
    {report.images[0] ? <Image className="dashboard-report-image" src={report.images[0].url} width={120} height={100} alt="" unoptimized /> : <div className="dashboard-report-image dashboard-report-placeholder" aria-hidden="true">✳</div>}
    <div className="dashboard-report-copy"><span className={`report-kind ${report.type === "LOST" ? "report-kind-lost" : "report-kind-found"}`}>{report.type === "LOST" ? "Lost" : "Found"}</span><h3>{report.title}</h3><p>{report.category.name} · {report.location}</p><small>{report.occurredAt.toLocaleDateString()} · {report.status === "ACTIVE" ? "Active" : "Resolved / closed"}</small><span className={`report-review-status report-status-${report.moderation.toLowerCase()}`}>{report.moderation === "APPROVED" ? "Approved" : report.moderation === "FLAGGED" ? "Under review" : report.moderation === "BLOCKED" ? "Not published" : "Pending review"}</span><Link className="button button-outline" href={`/items/${report.type.toLowerCase()}/${report.id}`}>View report</Link></div>
    <ReportActions id={report.id} type={report.type} status={report.status} />
  </article>;
  return <div className="site-page"><SiteHeader /><main className="dashboard-main page-width">
    <div className="dashboard-welcome"><div><p className="eyebrow">Your REVOK space</p><h1>Welcome, {user.name}.</h1><p>Your account overview and community history.</p></div><div className="dashboard-heading-actions"><Link href="/profile" className="button button-outline">Edit profile</Link><LogoutButton /></div></div>
    {user.status === "RESTRICTED" && <div className="notice-card" role="status"><strong>Browsing access</strong><p>Your account is restricted. You can browse available information, but protected actions are disabled.</p></div>}
    <section className="account-summary" aria-label="Account details">{user.image ? <Image className="account-avatar account-avatar-image" src={user.image} width={42} height={42} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>}<div><strong>{user.name}</strong><span>{user.username ? `@${user.username}` : "Username not set"}</span></div><span className="status-chip">{user.status === "ACTIVE" ? "Active" : "Restricted"}</span></section>
    <section className="dashboard-stats" aria-label="Community history"><article><span>Lost reports</span><strong>{lostCount}</strong><small>created by you</small></article><article><span>Found reports</span><strong>{foundCount}</strong><small>created by you</small></article><article><span>Member for</span><strong>{memberMonths}</strong><small>{memberMonths === 1 ? "month" : "months"}</small></article></section>
    <div className="dashboard-history-note"><strong>Report review</strong><p>New and edited reports are private to you while pending review. Approved active reports are visible on the community search page.</p></div>
    <section className="dashboard-reports" aria-labelledby="dashboard-reports-title"><div className="dashboard-section-heading"><div><p className="eyebrow">Your history</p><h2 id="dashboard-reports-title">Your reports</h2></div><div className="button-row"><Link className="button button-outline" href="/report/lost">Report lost</Link><Link className="button button-primary" href="/report/found">Report found</Link></div></div>
      {reports.length ? <div className="dashboard-report-groups">{(["LOST", "FOUND"] as const).map((kind) => { const typed = reports.filter((report) => report.type === kind); return <section className="dashboard-report-group" key={kind}><h3>My {kind === "LOST" ? "Lost" : "Found"} Reports <small>({typed.length})</small></h3>{([true, false] as const).map((active) => { const subset = typed.filter((report) => (report.status === "ACTIVE") === active); return subset.length ? <section className="dashboard-report-subgroup" key={String(active)}><h4>{active ? "Active" : "Resolved or closed"} <small>({subset.length})</small></h4><div className="dashboard-report-list">{subset.map(renderReport)}</div></section> : null; })}</section>; })}</div> : <div className="empty-state dashboard-empty"><p className="eyebrow">No reports yet</p><h2>Your lost and found reports will appear here.</h2><p>Submitted reports stay connected to your account, including after you sign out and back in.</p></div>}
    </section>
    <div className="dashboard-grid">{[["Potential matches", "Matching is not available yet."], ["Claims", "Claim and handover workflows are still in development."], ["Notifications", "Notifications are not connected yet."]].map(([title, description]) => <article className="dashboard-card" key={title}><h2>{title}</h2><p>{description}</p><span className="status-chip">Coming later</span></article>)}</div>
  </main><SiteFooter /></div>;
}
