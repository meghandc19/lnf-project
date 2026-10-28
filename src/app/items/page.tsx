import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { prisma } from "@/lib/prisma";
import { ITEM_CATEGORIES } from "@/lib/items/categories";

type Params = { q?: string; type?: string; category?: string; color?: string; location?: string; brand?: string; from?: string; to?: string; sort?: string; page?: string };
const pageSize = 24;

export default async function ItemsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const type = params.type === "FOUND" || params.type === "LOST" ? params.type : "ALL";
  const page = Math.max(1, Math.min(100, Number(params.page) || 1));
  const contains = (value: string) => ({ contains: value.slice(0, 100), mode: "insensitive" as const });
  const common: Record<string, unknown>[] = [];
  if (query) common.push({ OR: [{ title: contains(query) }, { description: contains(query) }, { brand: contains(query) }, { model: contains(query) }, { subcategory: contains(query) }, { category: { name: contains(query) } }] });
  if (params.category && ITEM_CATEGORIES.includes(params.category as (typeof ITEM_CATEGORIES)[number])) common.push({ category: { name: params.category } });
  if (params.color?.trim()) common.push({ color: contains(params.color.trim()) });
  if (params.location?.trim()) common.push({ OR: [{ location: contains(params.location.trim()) }, { locationDetails: contains(params.location.trim()) }] });
  if (params.brand?.trim()) common.push({ OR: [{ brand: contains(params.brand.trim()) }, { model: contains(params.brand.trim()) }] });
  const from = params.from && !Number.isNaN(Date.parse(params.from)) ? new Date(params.from) : null;
  const to = params.to && !Number.isNaN(Date.parse(params.to)) ? new Date(`${params.to}T23:59:59.999`) : null;
  if (from || to) common.push({ [type === "FOUND" ? "foundAt" : "lostAt"]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  const where = (kind: "LOST" | "FOUND") => ({ deletedAt: null, status: "ACTIVE" as const, moderation: "APPROVED" as const, AND: common.map((condition) => {
    if (condition && typeof condition === "object" && Object.hasOwn(condition, "lostAt")) return kind === "LOST" ? condition : { foundAt: (condition as { lostAt: unknown }).lostAt };
    return condition;
  }) });
  const [lost, found] = await Promise.all([
    type !== "FOUND" ? prisma.lostItem.findMany({ where: where("LOST"), orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { images: true, category: true } }) : [],
    type !== "LOST" ? prisma.foundItem.findMany({ where: where("FOUND"), orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { images: true, category: true } }) : [],
  ]);
  let reports = [...lost.map((report) => ({ ...report, type: "LOST" as const, occurredAt: report.lostAt })), ...found.map((report) => ({ ...report, type: "FOUND" as const, occurredAt: report.foundAt }))];
  if (params.sort === "relevance" && query) {
    const needle = query.toLocaleLowerCase();
    const score = (report: (typeof reports)[number]) => Number(report.title.toLocaleLowerCase().startsWith(needle)) * 6 + Number(report.title.toLocaleLowerCase().includes(needle)) * 4 + Number(!!report.brand?.toLocaleLowerCase().includes(needle)) * 3 + Number(!!report.model?.toLocaleLowerCase().includes(needle)) * 3 + Number(report.category.name.toLocaleLowerCase().includes(needle)) * 2 + Number(report.description.toLocaleLowerCase().includes(needle)) + Number(!!report.subcategory?.toLocaleLowerCase().includes(needle)) * 2;
    reports = reports.sort((a, b) => score(b) - score(a) || b.createdAt.getTime() - a.createdAt.getTime());
  }
  else reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const paramsForLink = new URLSearchParams(Object.entries(params).filter(([key, value]) => key !== "page" && value).map(([key, value]) => [key, value!]));
  const hasNext = lost.length === pageSize || found.length === pageSize;

  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width">
    <p className="eyebrow">Find items</p><h1 className="page-title">Look for what matters to you.</h1><p className="page-intro">Search approved lost and found reports. Private ownership details are never shown here.</p>
    <form className="item-search-form item-search-advanced" action="/items">
      <label>Keywords<input name="q" defaultValue={query} placeholder="Item name, brand, model, or description" maxLength={100} /></label>
      <label>Report type<select name="type" defaultValue={type}><option value="ALL">Lost and found</option><option value="LOST">Lost</option><option value="FOUND">Found</option></select></label>
      <label>Category<select name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{ITEM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Color<input name="color" defaultValue={params.color} maxLength={80} /></label>
      <label>Location or area<input name="location" defaultValue={params.location} maxLength={100} /></label>
      <label>Brand or model<input name="brand" defaultValue={params.brand} maxLength={100} /></label>
      <label>From date<input name="from" type="date" defaultValue={params.from} /></label><label>To date<input name="to" type="date" defaultValue={params.to} /></label>
      <label>Sort<select name="sort" defaultValue={params.sort ?? "newest"}><option value="newest">Newest</option><option value="relevance">Best match</option></select></label>
      <button className="button button-primary" type="submit">Search</button>{Object.values(params).some(Boolean) && <Link className="button button-outline" href="/items">Clear filters</Link>}
    </form>
    {reports.length ? <section className="report-list" aria-label="Approved item reports">{reports.map((report) => <article className="public-report-card" key={`${report.type}-${report.id}`}>
      <Link href={`/items/${report.type.toLowerCase()}/${report.id}`} aria-label={`View details for ${report.title}`} className="public-report-image-link">{report.images[0] ? <Image src={report.images[0].url} alt="" width={480} height={320} unoptimized className="public-report-image" /> : <div className="public-report-image public-report-placeholder" aria-hidden="true">✳</div>}</Link>
      <div className="public-report-content"><span className={`report-kind ${report.type === "LOST" ? "report-kind-lost" : "report-kind-found"}`}>{report.type === "LOST" ? "Lost" : "Found"}</span><p className="eyebrow">{report.category.name}{report.subcategory ? ` · ${report.subcategory}` : ""}</p><h2><Link href={`/items/${report.type.toLowerCase()}/${report.id}`}>{report.title}</Link></h2><p>{report.description}</p><div className="public-report-meta"><span>{report.location}</span><time dateTime={report.occurredAt.toISOString()}>{report.occurredAt.toLocaleDateString()}</time></div><Link className="button button-outline" href={`/items/${report.type.toLowerCase()}/${report.id}`}>View details</Link></div>
    </article>)}</section> : <section className="empty-state" aria-labelledby="empty-title"><span className="empty-symbol" aria-hidden="true">⌕</span><p className="eyebrow">No approved reports found</p><h2 id="empty-title">There are no matching public reports yet.</h2><p>{query ? "Try another search or clear some filters. Reports appear after review." : "New reports remain private to their owner while pending review."}</p><div className="button-row"><Link className="button button-primary" href="/report/lost">Report lost</Link><Link className="button button-outline" href="/report/found">Report found</Link></div></section>}
    {(page > 1 || hasNext) && <nav className="button-row" aria-label="Search pages">{page > 1 && <Link className="button button-outline" href={`/items?${new URLSearchParams([...paramsForLink, ["page", String(page - 1)]])}`}>Previous</Link>}{hasNext && <Link className="button button-outline" href={`/items?${new URLSearchParams([...paramsForLink, ["page", String(page + 1)]])}`}>More reports</Link>}</nav>}
  </main><SiteFooter /></div>;
}
