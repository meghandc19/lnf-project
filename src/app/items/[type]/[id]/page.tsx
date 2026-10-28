import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function ItemDetailsPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = await params;
  const type = rawType.toUpperCase();
  if (type !== "LOST" && type !== "FOUND") notFound();
  const user = await getAuthenticatedUser();
  if (user && (user.status === "BANNED" || user.status === "DELETED")) notFound();
  const where = { id, deletedAt: null, OR: [{ moderation: "APPROVED" as const, status: "ACTIVE" as const }, ...(user?.status === "ACTIVE" || user?.status === "RESTRICTED" ? [{ userId: user.id }] : [])] };
  const report = type === "LOST" ? await prisma.lostItem.findFirst({ where, include: { category: true, images: true } }) : await prisma.foundItem.findFirst({ where, include: { category: true, images: true } });
  if (!report) notFound();
  const owner = user?.id === report.userId;
  const occurredAt = "lostAt" in report ? report.lostAt : report.foundAt;
  const details = report as typeof report & { subcategory?: string | null; brand?: string | null; model?: string | null; color?: string | null; material?: string | null; identifyingMarks?: string | null; approximateTime?: string | null; locationDetails?: string | null; privateDetails?: string | null; contactedAbout?: string | null; custodyStatus?: string | null };
  const custodyLabels: Record<string, string> = { WITH_FINDER: "With the finder", SECURITY_OFFICE: "Submitted to a security office", HANDED_OVER: "Handed to an authorized person", UNKNOWN: "Not specified" };
  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width">
    <Link href="/items" className="button button-outline">← Back to search</Link>
    <article className="item-detail-card"><div className="item-detail-gallery">{report.images.length ? report.images.map((image, index) => <Image key={image.id} src={image.url} alt={`${report.title} photo ${index + 1}`} width={900} height={700} unoptimized />) : <div className="public-report-placeholder">No photo provided</div>}</div>
      <div className="item-detail-copy"><span className={`report-kind report-kind-${type.toLowerCase()}`}>{type === "LOST" ? "Lost item" : "Found item"}</span><p className="eyebrow">{report.category.name}{details.subcategory ? ` · ${details.subcategory}` : ""}</p><h1 className="page-title">{report.title}</h1><p>{report.description}</p>
        <dl className="item-detail-facts"><div><dt>{type === "LOST" ? "Last seen" : "Found at"}</dt><dd>{report.location}{details.locationDetails ? ` · ${details.locationDetails}` : ""}</dd></div>{occurredAt && <div><dt>Date</dt><dd>{occurredAt.toLocaleDateString()}{details.approximateTime ? ` · ${details.approximateTime}` : ""}</dd></div>}{details.brand && <div><dt>Brand</dt><dd>{details.brand}</dd></div>}{details.model && <div><dt>Model</dt><dd>{details.model}</dd></div>}{details.color && <div><dt>Color</dt><dd>{details.color}</dd></div>}{details.material && <div><dt>Material or appearance</dt><dd>{details.material}</dd></div>}{details.identifyingMarks && <div><dt>Visible distinguishing marks</dt><dd>{details.identifyingMarks}</dd></div>}{type === "FOUND" && details.custodyStatus && <div><dt>Item location</dt><dd>{custodyLabels[details.custodyStatus] ?? "Not specified"}</dd></div>}{owner && details.privateDetails && <div className="private-detail"><dt>Private verification detail (owner only)</dt><dd>{details.privateDetails}</dd></div>}{owner && details.contactedAbout && <div className="private-detail"><dt>Already contacted</dt><dd>{details.contactedAbout}</dd></div>}</dl>
        <p className="report-privacy-note">Contact details and private verification information are not shown on public reports. Arrange a safe handover in a public place.</p>
      </div></article>
  </main><SiteFooter /></div>;
}
