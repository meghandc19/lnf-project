import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClaimForm from "@/components/items/ClaimForm";
import ItemImageCarousel from "@/components/items/ItemImageCarousel";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { canClaim } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { normalizeSearchText, scorePossibleMatch } from "@/lib/items/matching";

export default async function ItemDetailsPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = await params;
  const type = rawType.toUpperCase();
  if (type !== "LOST" && type !== "FOUND") notFound();
  const user = await getAuthenticatedUser();
  if (user && (user.status === "BANNED" || user.status === "DELETED")) notFound();
  const where = { id, deletedAt: null, OR: [{ moderation: "APPROVED" as const, status: "ACTIVE" as const }, ...(user?.status === "ACTIVE" || user?.status === "RESTRICTED" ? [{ userId: user.id }] : [])] };
  const report = type === "LOST" ? await prisma.lostItem.findFirst({ where, include: { category: true, images: { select: { id: true, url: true } } } }) : await prisma.foundItem.findFirst({ where, include: { category: true, images: { select: { id: true, url: true } } } });
  if (!report) notFound();
  const owner = user?.id === report.userId;
  const occurredAt = "lostAt" in report ? report.lostAt : report.foundAt;
  const details = report as typeof report & { subcategory?: string | null; brand?: string | null; model?: string | null; color?: string | null; material?: string | null; identifyingMarks?: string | null; approximateTime?: string | null; locationDetails?: string | null; privateDetails?: string | null; contactedAbout?: string | null; custodyStatus?: string | null };
  const custodyLabels: Record<string, string> = { WITH_FINDER: "With the finder", SECURITY_OFFICE: "Submitted to a security office", HANDED_OVER: "With a REVOK Steward", UNKNOWN: "Not specified" };
  const existingClaim = type === "FOUND" && user && !owner ? await prisma.claim.findFirst({ where: { userId: user.id, foundItemId: id }, select: { status: true } }) : null;
  const claimAccess = !user ? "guest" : owner ? "owner" : user.status !== "ACTIVE" ? "restricted" : canClaim(user.status, user.phoneNumberVerified) ? "eligible" : "unverified";
  const lostTokens = type === "LOST" ? normalizeSearchText(`${report.title} ${details.brand ?? ""} ${details.color ?? ""}`).split(" ").filter((token) => token.length >= 3).slice(0, 5) : [];
  const matchConditions = [{ categoryId: report.categoryId }, ...lostTokens.flatMap((token) => [{ title: { contains: token, mode: "insensitive" as const } }, { description: { contains: token, mode: "insensitive" as const } }, { brand: { contains: token, mode: "insensitive" as const } }, { color: { contains: token, mode: "insensitive" as const } }, { location: { contains: token, mode: "insensitive" as const } }])];
  const matches = type === "LOST" ? await prisma.foundItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED", OR: matchConditions }, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, title: true, description: true, location: true, foundAt: true, brand: true, color: true, category: { select: { name: true } }, images: { take: 1, select: { id: true, url: true } } } }) : [];
  const possibleMatches = type === "LOST" ? matches.map((item) => ({ item, score: scorePossibleMatch({ title: report.title, category: report.category.name, description: report.description, brand: details.brand, color: details.color, location: report.location, occurredAt }, { title: item.title, category: item.category.name, description: item.description, brand: item.brand, color: item.color, location: item.location, occurredAt: item.foundAt }) })).filter((match) => match.score >= 45).sort((a, b) => b.score - a.score || b.item.foundAt.getTime() - a.item.foundAt.getTime()).slice(0, 4) : [];
  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width item-detail-page">
    <Link href="/items" className="button button-outline">← Back to Search Items</Link>
    <article className="item-detail-card"><div className="item-detail-gallery"><ItemImageCarousel images={report.images} title={report.title} /></div>
      <div className="item-detail-copy"><span className={`report-kind report-kind-${type.toLowerCase()}`}>{type === "LOST" ? "Lost item" : "Found item"}</span><p className="eyebrow">{report.category.name}{details.subcategory ? ` · ${details.subcategory}` : ""}</p><h1 className="page-title">{report.title}</h1><p>{report.description}</p>
        <dl className="item-detail-facts"><div><dt>{type === "LOST" ? "Last seen" : "Found at"}</dt><dd>{report.location}{details.locationDetails ? ` · ${details.locationDetails}` : ""}</dd></div>{occurredAt && <div><dt>{type === "LOST" ? "Date lost" : "Date found"}</dt><dd>{occurredAt.toLocaleDateString()}{details.approximateTime ? ` · ${details.approximateTime}` : ""}</dd></div>}{details.brand && <div><dt>Brand</dt><dd>{details.brand}</dd></div>}{details.model && <div><dt>Model</dt><dd>{details.model}</dd></div>}{details.color && <div><dt>Color</dt><dd>{details.color}</dd></div>}{details.material && <div><dt>Material or appearance</dt><dd>{details.material}</dd></div>}{details.identifyingMarks && <div><dt>Visible distinguishing marks</dt><dd>{details.identifyingMarks}</dd></div>}{type === "FOUND" && details.custodyStatus && <div><dt>Current custody</dt><dd>{custodyLabels[details.custodyStatus] ?? "Not specified"}</dd></div>}{owner && details.privateDetails && <div className="private-detail"><dt>Private verification detail (owner only)</dt><dd>{details.privateDetails}</dd></div>}{owner && details.contactedAbout && <div className="private-detail"><dt>Already contacted</dt><dd>{details.contactedAbout}</dd></div>}</dl>
        {type === "FOUND" && <div className="item-claim-action"><ClaimForm foundItemId={report.id} itemTitle={report.title} access={claimAccess} existingStatus={existingClaim?.status ?? null} /></div>}
        <p className="report-privacy-note">Contact details and private verification information are not shown on public reports. Arrange a safe handover in a public place.</p>
      </div>
    </article>
    {possibleMatches.length > 0 && <section className="possible-matches" aria-labelledby="possible-matches-title"><div><p className="eyebrow">Worth a look</p><h2 id="possible-matches-title">Possible matches</h2><p>These approved found reports share details with this lost report. They are suggestions only.</p></div><div className="possible-matches-grid">{possibleMatches.map(({ item }) => <Link className="possible-match-card" href={`/items/found/${item.id}`} key={item.id}>{item.images[0] ? <Image src={item.images[0].url} width={180} height={150} alt="" unoptimized /> : <span className="possible-match-placeholder" aria-hidden="true">✳</span>}<span><strong>{item.title}</strong><small>Found · {item.category.name}</small><small>{item.location} · {item.foundAt.toLocaleDateString()}</small></span></Link>)}</div></section>}
  </main><SiteFooter /></div>;
}
