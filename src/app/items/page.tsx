import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { prisma } from "@/lib/prisma";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const type = params.type === "FOUND" || params.type === "LOST" ? params.type : "ALL";
  const search = query ? { OR: [{ title: { contains: query, mode: "insensitive" as const } }, { description: { contains: query, mode: "insensitive" as const } }, { location: { contains: query, mode: "insensitive" as const } }, { category: { name: { contains: query, mode: "insensitive" as const } } }] } : {};
  const [lost, found] = await Promise.all([
    type !== "FOUND" ? prisma.lostItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED", ...search }, orderBy: { createdAt: "desc" }, take: 50, include: { images: true, category: true } }) : [],
    type !== "LOST" ? prisma.foundItem.findMany({ where: { deletedAt: null, status: "ACTIVE", moderation: "APPROVED", ...search }, orderBy: { createdAt: "desc" }, take: 50, include: { images: true, category: true } }) : [],
  ]);
  const reports = [...lost.map((report) => ({ ...report, type: "LOST" as const, occurredAt: report.lostAt })), ...found.map((report) => ({ ...report, type: "FOUND" as const, occurredAt: report.foundAt }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50);

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width">
        <p className="eyebrow">Find items</p>
        <h1 className="page-title">Look for what matters to you.</h1>
        <p className="page-intro">Browse lost and found reports approved for the community.</p>
        <form className="item-search-form" action="/items">
          <label className="visually-hidden" htmlFor="item-search">Search reports</label>
          <input id="item-search" name="q" defaultValue={query} placeholder="Search by item, description, category, or place" maxLength={100} />
          <select aria-label="Report type" name="type" defaultValue={type}><option value="ALL">All reports</option><option value="LOST">Lost</option><option value="FOUND">Found</option></select>
          <button className="button button-primary" type="submit">Search</button>
          {(query || type !== "ALL") && <Link className="button button-outline" href="/items">Clear</Link>}
        </form>
        {reports.length ? <section className="report-list" aria-label="Approved item reports">
          {reports.map((report) => <article className="public-report-card" key={`${report.type}-${report.id}`}>
            {report.images[0] ? <Image src={report.images[0].url} alt="" width={480} height={320} unoptimized className="public-report-image" /> : <div className="public-report-image public-report-placeholder" aria-hidden="true">✳</div>}
            <div className="public-report-content"><span className={`report-kind ${report.type === "LOST" ? "report-kind-lost" : "report-kind-found"}`}>{report.type === "LOST" ? "Lost" : "Found"}</span><p className="eyebrow">{report.category.name}</p><h2>{report.title}</h2><p>{report.description}</p><div className="public-report-meta"><span>{report.location}</span><time dateTime={report.occurredAt.toISOString()}>{report.occurredAt.toLocaleDateString()}</time></div></div>
          </article>)}
        </section> : <section className="empty-state" aria-labelledby="empty-title">
          <span className="empty-symbol" aria-hidden="true">⌕</span><p className="eyebrow">No approved reports found</p><h2 id="empty-title">There are no matching public reports yet.</h2>
          <p>{query ? "Try a different search or clear the filters. Reports appear here after review." : "New reports remain private to their owner while they are pending review."}</p>
          <div className="button-row"><Link className="button button-primary" href="/report/lost">Report lost</Link><Link className="button button-outline" href="/report/found">Report found</Link></div>
        </section>}
      </main>
      <SiteFooter />
    </div>
  );
}
