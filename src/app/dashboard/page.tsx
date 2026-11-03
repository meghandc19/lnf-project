import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCanBrowse } from "@/lib/auth/guards";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import LogoutButton from "@/components/auth/LogoutButton";
import StewardDashboard from "@/components/claims/HandoverControls";
import { HandoverButton } from "@/components/claims/HandoverControls";
import { ReportActions } from "@/components/reports/ReportManagement";

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  let user;
  try { user = await requireCanBrowse(); } catch { redirect("/login"); }
  const view = (await searchParams)?.view;
  const showKind = view === "lost" || view === "found" ? view.toUpperCase() : null;
  const participant = { is: { participants: { some: { userId: user.id, deletedAt: null } } } };
  const [lostCount, foundCount, sentClaims, receivedClaims, lostRows, foundRows, sentHints] = await Promise.all([
    prisma.lostItem.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.foundItem.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.claim.count({ where: { userId: user.id, foundItemId: { not: null }, foundItem: { userId: { not: user.id } }, conversation: participant } }),
    prisma.claim.count({ where: { foundItem: { userId: user.id }, userId: { not: user.id }, conversation: participant } }),
    prisma.lostItem.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { images: true, category: true, _count: { select: { reportMessages: { where: { parentMessageId: null } } } } } }),
    prisma.foundItem.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { images: true, category: true, _count: { select: { reportMessages: { where: { parentMessageId: null } } } }, claims: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } } } }),
    prisma.reportMessage.findMany({ where: { senderId: user.id, parentMessageId: null, kind: "HINT" }, orderBy: { createdAt: "desc" }, take: 50, include: { sender: { select: { name: true } }, replies: { orderBy: { createdAt: "asc" }, take: 100, include: { sender: { select: { name: true } } } }, lostItem: { select: { id: true, title: true, deletedAt: true } }, foundItem: { select: { id: true, title: true, deletedAt: true } } } }),
  ]);
  type Report = { id: string; type: "LOST" | "FOUND"; title: string; category: { name: string }; location: string; images: { url: string }[]; occurredAt: Date; updatedAt: Date; status: string; moderation: string; communicationCount: number };
  const reports: Report[] = [
    ...(showKind === "LOST" ? lostRows.map((report) => ({ id: report.id, type: "LOST" as const, title: report.title, category: report.category, location: report.location, images: report.images, occurredAt: report.lostAt, updatedAt: report.updatedAt, status: report.status, moderation: report.moderation, communicationCount: report._count.reportMessages })) : []),
    ...(showKind === "FOUND" ? foundRows.map((report) => ({ id: report.id, type: "FOUND" as const, title: report.title, category: report.category, location: report.location, images: report.images, occurredAt: report.foundAt, updatedAt: report.updatedAt, status: report.status, moderation: report.moderation, communicationCount: report._count.reportMessages })) : []),
  ];
  const renderReport = (report: Report) => {
    const type = report.type ?? "LOST";
    const isFound = type === "FOUND";
    const foundReport = isFound ? foundRows.find((item) => item.id === report.id) : null;
    const locked = Boolean(foundReport && (foundReport.claims.length > 0 || foundReport.custodianId || ["HANDOVER_PENDING", "WITH_STEWARD", "HANDED_OVER"].includes(foundReport.custodyStatus ?? "")));
    return <article className="dashboard-report-card" key={`${type}-${report.id}`}>
      {report.images[0] ? <Image className="dashboard-report-image" src={report.images[0].url} width={120} height={100} alt="" unoptimized /> : <div className="dashboard-report-image dashboard-report-placeholder" aria-hidden="true">✳</div>}
      <div className="dashboard-report-copy"><span className={`report-kind report-kind-${type.toLowerCase()}`}>{isFound ? "Found" : "Lost"}</span><h3>{report.title}</h3><p>{report.category.name} · {report.location}</p><small>{report.occurredAt?.toLocaleDateString()} · {report.status === "ACTIVE" ? "Active" : "Resolved / closed"}</small><small>Listed on {report.updatedAt.toLocaleDateString()}</small><span className={`report-review-status report-status-${report.moderation.toLowerCase()}`}>{report.moderation === "APPROVED" ? "Approved" : report.moderation === "FLAGGED" ? "Under review" : report.moderation === "BLOCKED" ? "Not published" : "Pending review"}</span><Link className="button button-outline" href={`/items/${type.toLowerCase()}/${report.id}`}>View report</Link></div>
      <div className="dashboard-report-actions"><ReportActions id={report.id} type={type} status={report.status} locked={locked} /><Link className="button button-outline" href={`/dashboard/reports/${type.toLowerCase()}/${encodeURIComponent(report.id)}/communications`}>Hints ({report.communicationCount})</Link>{isFound && foundReport && !locked && <HandoverButton foundItemId={report.id} />}{locked && <small>This found report has an active claim or Steward handover. Editing or deleting is paused until it is resolved.</small>}</div>
    </article>;
  };
  const claimCount = sentClaims + receivedClaims;

  return <div className="site-page"><SiteHeader /><main className="dashboard-main page-width">
    <section className="dashboard-user-header" aria-label="Your account details">
      {user.image ? <Image className="dashboard-user-avatar" src={user.image} width={58} height={58} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="dashboard-user-avatar dashboard-user-avatar-placeholder" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>}
      <div className="dashboard-user-copy"><p className="eyebrow">Your REVOK space</p><h1>{user.name}</h1><span>{user.username ? `@${user.username}` : "Username not set"}</span><span>{user.phoneNumber || "Phone number not added"}{user.phoneNumberVerified ? " · Verified" : ""}</span></div>
      <span className={`status-chip${user.status === "ACTIVE" ? " dashboard-active-chip" : ""}`}>{user.status === "ACTIVE" ? "Active" : "Restricted"}</span><LogoutButton />
    </section>
    {user.status === "RESTRICTED" && <div className="notice-card" role="status"><strong>Browsing access</strong><p>Your account is restricted. You can browse available information, but protected actions are disabled.</p></div>}
    <section className="dashboard-stats" aria-label="Your account activity">
      <Link href="/dashboard?view=lost" aria-label={`${lostCount} lost reports`}><span>Lost Reports</span><strong>{lostCount}</strong><small>View your lost reports →</small></Link>
      <Link href="/dashboard?view=found" aria-label={`${foundCount} found reports`}><span>Found Reports</span><strong>{foundCount}</strong><small>View your found reports →</small></Link>
      <Link href="/dashboard/claims?view=sent" aria-label={`${claimCount} claim requests`}><span>Claim Requests</span><strong>{claimCount}</strong><small>Open claims →</small></Link>
    </section>
    {showKind ? <section className="dashboard-reports" aria-labelledby="dashboard-reports-title"><div className="dashboard-section-heading"><div><p className="eyebrow">Your history</p><h2 id="dashboard-reports-title">My {showKind === "LOST" ? "Lost" : "Found"} Reports</h2></div><div className="button-row"><Link className="button button-outline" href="/dashboard">Dashboard</Link><Link className="button button-primary" href={showKind === "LOST" ? "/report/lost" : "/report/found"}>Report {showKind.toLowerCase()}</Link></div></div>
      {reports.length ? <div className="dashboard-report-list">{reports.map(renderReport)}</div> : <div className="empty-state dashboard-empty"><h2>No {showKind.toLowerCase()} reports yet.</h2><p>Your reports will appear here after you submit one.</p></div>}
    </section> : null}
    <section className="dashboard-sent-hints" aria-labelledby="dashboard-sent-hints-title"><div className="dashboard-section-heading"><div><p className="eyebrow">Private conversations</p><h2 id="dashboard-sent-hints-title">Hints by you</h2><p>Hints you sent and replies from the report owner, kept together by item.</p></div><span className="status-chip">{sentHints.length}</span></div>
      {sentHints.length ? <div className="dashboard-sent-hint-list">{sentHints.map((hint) => {
        const report = hint.lostItem ?? hint.foundItem;
        const reportType = hint.lostItem ? "lost" : "found";
        const messages = [hint, ...hint.replies].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return <article className="dashboard-sent-hint" key={hint.id}>
          <header className="dashboard-sent-hint-heading"><div><span className="report-kind">{reportType === "lost" ? "Lost report" : "Found report"}</span><h3>{report?.title ?? "Report unavailable"}</h3><small>Hint sent {hint.createdAt.toLocaleDateString()}</small></div>{report && !report.deletedAt && <Link className="button button-outline" href={`/dashboard/reports/${reportType}/${encodeURIComponent(report.id)}/communications?thread=${encodeURIComponent(hint.id)}`}>Open conversation</Link>}</header>
          <div className="dashboard-sent-hint-chat" role="list" aria-label={`Hint conversation about ${report?.title ?? "an unavailable report"}`}>
            {messages.map((entry) => <article className={`dashboard-sent-hint-message${entry.senderId === user.id ? " is-mine" : ""}`} role="listitem" key={entry.id}><strong>{entry.senderId === user.id ? "You" : entry.sender.name}</strong><p>{entry.body}</p><time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString()}</time></article>)}
          </div>
        </article>;
      })}</div> : <div className="empty-state dashboard-empty"><h3>No hints sent yet</h3><p>Hints you send from a report will appear here with replies from its owner.</p></div>}
    </section>
    {user.role === "REVOK_STEWARD" && <StewardDashboard />}
  </main><SiteFooter /></div>;
}
