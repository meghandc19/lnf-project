import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ItemReviewControls from "@/components/admin/ItemReviewControls";
import ReportSubmitterControls from "@/components/admin/ReportSubmitterControls";

const submitterSelection = {
  id: true,
  name: true,
  username: true,
  image: true,
  phoneNumber: true,
  role: true,
  status: true,
  emailVerified: true,
  phoneNumberVerified: true,
} as const;

export default async function AdminReportsPage() {
  const admin = await requireAdmin();
  const [lost, found] = await Promise.all([
    prisma.lostItem.findMany({
      where: { deletedAt: null, moderation: { in: ["PENDING", "FLAGGED"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        lostAt: true,
        createdAt: true,
        brand: true,
        color: true,
        identifyingMarks: true,
        moderation: true,
        category: { select: { name: true } },
        images: { select: { id: true, url: true } },
        user: { select: submitterSelection },
      },
    }),
    prisma.foundItem.findMany({
      where: { deletedAt: null, moderation: { in: ["PENDING", "FLAGGED"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        foundAt: true,
        createdAt: true,
        brand: true,
        color: true,
        identifyingMarks: true,
        moderation: true,
        category: { select: { name: true } },
        images: { select: { id: true, url: true } },
        user: { select: submitterSelection },
      },
    }),
  ]);

  const reports = [
    ...lost.map((report) => ({ ...report, type: "LOST" as const, occurredAt: report.lostAt })),
    ...found.map((report) => ({ ...report, type: "FOUND" as const, occurredAt: report.foundAt })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 100);

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width">
        <Link className="button button-outline" href="/admin">â† Admin</Link>
        <p className="eyebrow">Server-protected review queue</p>
        <h1 className="page-title">Item reports to review</h1>
        <p className="page-intro">Review the report and its submitter before deciding whether it can be shared. Private ownership details are not shown.</p>
        {reports.length ? (
          <div className="admin-review-list">
            {reports.map((report) => (
              <article className="admin-review-card" key={`${report.type}-${report.id}`}>
                <div>
                  <span className="report-kind">{report.type === "LOST" ? "Lost" : "Found"} Â· {report.moderation === "FLAGGED" ? "Flagged" : "Pending"}</span>
                  <h2>{report.title}</h2>
                  <p className="eyebrow">{report.category.name}{report.brand ? ` Â· ${report.brand}` : ""}{report.color ? ` Â· ${report.color}` : ""}</p>
                  <p>{report.description}</p>
                  <p><strong>{report.location}</strong> Â· {report.occurredAt.toLocaleDateString()}</p>
                  {report.identifyingMarks && <p>Visible marks: {report.identifyingMarks}</p>}
                  <small>Submitted {report.createdAt.toLocaleDateString()}</small>
                  <ReportSubmitterControls user={report.user} actorRole={admin.role} />
                  {report.images.length > 0 && (
                    <div className="admin-review-images">
                      {report.images.map((photo, index) => <Image key={photo.id} src={photo.url} width={220} height={150} alt={`${report.title} review photo ${index + 1}`} unoptimized />)}
                    </div>
                  )}
                </div>
                <ItemReviewControls id={report.id} type={report.type} />
              </article>
            ))}
          </div>
        ) : (
          <section className="empty-state">
            <p className="eyebrow">Queue clear</p>
            <h2>No pending reports need review.</h2>
            <p>New and flagged reports will appear here.</p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
