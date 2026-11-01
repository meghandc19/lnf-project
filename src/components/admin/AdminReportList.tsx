import Image from "next/image";
import ItemReviewControls from "@/components/admin/ItemReviewControls";
import ReportSubmitterControls from "@/components/admin/ReportSubmitterControls";

type ManagedRole = "USER" | "ADMIN" | "SUPER_ADMIN" | "REVOK_STEWARD";
type ReportType = "LOST" | "FOUND";
type ItemReport = {
  id: string;
  title: string;
  description: string;
  location: string;
  occurredAt: Date;
  createdAt: Date;
  brand: string | null;
  color: string | null;
  identifyingMarks: string | null;
  moderation: string;
  category: { name: string };
  images: { id: string; url: string }[];
  user: { id: string; name: string; username: string | null; image: string | null; phoneNumber: string | null; role: ManagedRole; status: "ACTIVE" | "RESTRICTED" | "BANNED" | "DELETED"; emailVerified: boolean; phoneNumberVerified: boolean };
};

export default function AdminReportList({ reports, actorRole, pendingOnly, type }: { reports: ItemReport[]; actorRole: ManagedRole; pendingOnly: boolean; type: ReportType }) {
  const label = type === "LOST" ? "Lost" : "Found";
  return <div className="admin-lost-report-list">{reports.map((report) => <details className="admin-lost-report-card" key={report.id}>
    <summary className="admin-lost-report-summary">
      {report.images[0] ? <Image className="admin-lost-report-image" src={report.images[0].url} width={76} height={76} alt="" unoptimized /> : <span className="admin-lost-report-image admin-lost-report-placeholder" aria-hidden="true">✳</span>}
      <span className="admin-lost-report-main"><span className="admin-lost-report-status">{label} · {report.moderation === "FLAGGED" ? "Flagged" : report.moderation === "APPROVED" ? "Approved" : report.moderation === "BLOCKED" ? "Rejected" : "Pending"}</span><strong>{report.title}</strong><small>Uploaded {report.createdAt.toLocaleString()}</small></span>
      <span className="admin-lost-report-submitter">{report.user.image ? <Image src={report.user.image} width={34} height={34} alt="" unoptimized referrerPolicy="no-referrer" /> : <span aria-hidden="true">{report.user.name.slice(0, 1).toUpperCase()}</span>}<span><strong>{report.user.name}</strong><small>{report.user.username ? `@${report.user.username}` : "No username"}</small></span></span>
      <span className="admin-lost-report-open">View details</span>
    </summary>
    <div className="admin-lost-report-details">
      <div className="admin-lost-report-copy"><p className="eyebrow">{report.category.name}{report.brand ? ` · ${report.brand}` : ""}{report.color ? ` · ${report.color}` : ""}</p><p>{report.description}</p><p><strong>{report.location}</strong> · {label} {report.occurredAt.toLocaleDateString()}</p>{report.identifyingMarks && <p>Visible marks: {report.identifyingMarks}</p>}<small>Submitted {report.createdAt.toLocaleString()}</small></div>
      <ReportSubmitterControls user={report.user} actorRole={actorRole} />
      {report.images.length > 0 && <div className="admin-review-images">{report.images.map((photo, index) => <Image key={photo.id} src={photo.url} width={220} height={150} alt={`${report.title} review photo ${index + 1}`} unoptimized />)}</div>}
      {pendingOnly && report.moderation !== "APPROVED" && <ItemReviewControls id={report.id} type={type} />}
    </div>
  </details>)}</div>;
}
