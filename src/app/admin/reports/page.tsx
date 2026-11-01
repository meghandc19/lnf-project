import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ItemReviewControls from "@/components/admin/ItemReviewControls";
import ReportSubmitterControls from "@/components/admin/ReportSubmitterControls";
import AdminReportList from "@/components/admin/AdminReportList";

const submitterSelection = { id: true, name: true, username: true, image: true, phoneNumber: true, role: true, status: true, emailVerified: true, phoneNumberVerified: true } as const;

export default async function AdminReportsPage({ searchParams }: { searchParams?: Promise<{ type?: string; mode?: string; q?: string }> }) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const typeFilter = query?.type === "LOST" || query?.type === "FOUND" ? query.type : "ALL";
  const mode = query?.mode === "all" ? "all" : "pending";
  const searchTerm = typeFilter === "LOST" || typeFilter === "FOUND" ? query?.q?.trim().slice(0, 100) ?? "" : "";
  const reportWhere = { deletedAt: null, ...(mode === "pending" ? { moderation: { in: ["PENDING", "FLAGGED"] as ("PENDING" | "FLAGGED")[] } } : {}) };
  const [lost, found] = await Promise.all([
    typeFilter !== "FOUND" ? prisma.lostItem.findMany({ where: { ...reportWhere, ...(searchTerm ? { title: { contains: searchTerm, mode: "insensitive" as const } } : {}) }, orderBy: { createdAt: mode === "pending" ? "asc" : "desc" }, take: 500, select: { id: true, title: true, description: true, location: true, lostAt: true, createdAt: true, brand: true, color: true, identifyingMarks: true, moderation: true, category: { select: { name: true } }, images: { select: { id: true, url: true } }, user: { select: submitterSelection } } }) : Promise.resolve([]),
    typeFilter !== "LOST" ? prisma.foundItem.findMany({ where: { ...reportWhere, ...(typeFilter === "FOUND" && searchTerm ? { title: { contains: searchTerm, mode: "insensitive" as const } } : {}) }, orderBy: { createdAt: mode === "pending" ? "asc" : "desc" }, take: 500, select: { id: true, title: true, description: true, location: true, foundAt: true, createdAt: true, brand: true, color: true, identifyingMarks: true, moderation: true, category: { select: { name: true } }, images: { select: { id: true, url: true } }, user: { select: submitterSelection } } }) : Promise.resolve([]),
  ]);
  const reports = [...lost.map((report) => ({ ...report, type: "LOST" as const, occurredAt: report.lostAt })), ...found.map((report) => ({ ...report, type: "FOUND" as const, occurredAt: report.foundAt }))].sort((a, b) => mode === "pending" ? a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 500);
  const selectedReports = typeFilter === "LOST" ? lost.map(({ lostAt, ...report }) => ({ ...report, occurredAt: lostAt })) : found.map(({ foundAt, ...report }) => ({ ...report, occurredAt: foundAt }));
  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width admin-report-queue-page">
    <Link className="button button-outline" href="/admin">← Admin overview</Link>
    <p className="eyebrow">Server-protected item management</p>
    <h1 className="page-title">{mode === "pending" ? "Item reports to review" : "All item reports"}{typeFilter !== "ALL" ? ` · ${typeFilter === "LOST" ? "Lost" : "Found"}` : ""}</h1>
    <p className="page-intro">Review each report and its submitter. Approvals and rejections are recorded and can be undone for 10 minutes.</p>
    {typeFilter === "LOST" || typeFilter === "FOUND" ? <>
      <nav className="admin-tools-nav" aria-label={`${typeFilter === "LOST" ? "Lost" : "Found"} report review`}><Link href={`/admin/reports?type=${typeFilter}&mode=pending${searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""}`}>Needs review</Link>{mode === "pending" && <Link href={`/admin/reports?type=${typeFilter}&mode=all${searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""}`}>Back to {typeFilter === "LOST" ? "lost" : "found"} reports</Link>}</nav>
      <form className="admin-report-search" action="/admin/reports" method="get"><input type="hidden" name="type" value={typeFilter} /><input type="hidden" name="mode" value={mode} /><label htmlFor={`${typeFilter.toLowerCase()}-report-search`}>Search {typeFilter === "LOST" ? "lost" : "found"} reports by title</label><div><input id={`${typeFilter.toLowerCase()}-report-search`} name="q" type="search" defaultValue={searchTerm} maxLength={100} placeholder="Search a title, for example JBL" /><button className="button button-primary" type="submit">Search</button></div></form>
      {selectedReports.length ? <AdminReportList reports={selectedReports} actorRole={admin.role} pendingOnly={mode === "pending"} type={typeFilter} /> : <section className="empty-state"><p className="eyebrow">{typeFilter === "LOST" ? "Lost" : "Found"} reports</p><h2>{searchTerm ? `No ${typeFilter === "LOST" ? "lost" : "found"} reports match that title.` : mode === "pending" ? `No ${typeFilter === "LOST" ? "lost" : "found"} reports need review.` : `No ${typeFilter === "LOST" ? "lost" : "found"} reports have been submitted.`}</h2><p>{searchTerm ? "Try another item title." : "New reports will appear here."}</p></section>}
    </> : <>
    <nav className="admin-tools-nav" aria-label="Report filters"><Link href={`/admin/reports?type=${typeFilter}&mode=pending`}>Needs review</Link><Link href={`/admin/reports?type=${typeFilter}&mode=all`}>All reports</Link><Link href="/admin/reports?type=LOST&amp;mode=all">Lost</Link><Link href="/admin/reports?type=FOUND&amp;mode=all">Found</Link></nav>
    {reports.length ? <div className="admin-review-list">{reports.map((report) => <article className="admin-review-card" key={`${report.type}-${report.id}`}>
      <div><span className="report-kind">{report.type === "LOST" ? "Lost" : "Found"} · {report.moderation === "FLAGGED" ? "Flagged" : report.moderation === "APPROVED" ? "Approved" : report.moderation === "BLOCKED" ? "Rejected" : "Pending"}</span><h2>{report.title}</h2><p className="eyebrow">{report.category.name}{report.brand ? ` · ${report.brand}` : ""}{report.color ? ` · ${report.color}` : ""}</p><p>{report.description}</p><p><strong>{report.location}</strong> · {report.occurredAt.toLocaleDateString()}</p>{report.identifyingMarks && <p>Visible marks: {report.identifyingMarks}</p>}<small>Submitted {report.createdAt.toLocaleString()}</small><ReportSubmitterControls user={report.user} actorRole={admin.role} />{report.images.length > 0 && <div className="admin-review-images">{report.images.map((photo, index) => <Image key={photo.id} src={photo.url} width={220} height={150} alt={`${report.title} review photo ${index + 1}`} unoptimized />)}</div>}</div>
      {mode === "pending" && report.moderation !== "APPROVED" && <ItemReviewControls id={report.id} type={report.type} />}
    </article>)}</div> : <section className="empty-state"><p className="eyebrow">Queue clear</p><h2>{mode === "pending" ? "No pending item reports need review." : "No reports match this filter."}</h2><p>{mode === "pending" ? "New and flagged reports will appear here." : "Try another report filter."}</p></section>}
    </>}
  </main><SiteFooter /></div>;
}
