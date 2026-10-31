import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SearchControls from "@/components/items/SearchControls";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { prisma } from "@/lib/prisma";
import { ITEM_CATEGORIES } from "@/lib/items/categories";
import { normalizeSearchText, searchRelevance, searchTokenVariants } from "@/lib/items/matching";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Search Items | REVOK",
  description: "Search approved lost and found items in your community.",
};

type Params = { q?: string; type?: string; category?: string; location?: string; from?: string; to?: string; sort?: string; page?: string };
const pageSize = 24;
const maxPage = 40;
const searchableFields = ["title", "description", "brand", "model", "subcategory"] as const;

function contains(value: string) {
  return { contains: value.slice(0, 100), mode: "insensitive" as const };
}

export default async function ItemsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const type: "FOUND" | "LOST" = params.type === "LOST" ? "LOST" : "FOUND";
  const sort: "newest" | "oldest" | "relevance" = params.sort === "oldest" ? "oldest" : params.sort === "relevance" && query ? "relevance" : "newest";
  const page = Math.max(1, Math.min(maxPage, Number(params.page) || 1));
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean).slice(0, 8);
  const filters: Record<string, unknown>[] = [];

  if (tokens.length) {
    for (const token of tokens) {
      const alternatives = searchTokenVariants(token);
      filters.push({ OR: alternatives.flatMap((variant) => [
        ...searchableFields.map((field) => ({ [field]: contains(variant) })),
        { category: { name: contains(variant) } },
      ]) });
    }
  }
  if (params.category && ITEM_CATEGORIES.includes(params.category as (typeof ITEM_CATEGORIES)[number])) filters.push({ category: { name: params.category } });
  if (params.location?.trim()) filters.push({ OR: [{ location: contains(params.location.trim()) }, { locationDetails: contains(params.location.trim()) }] });
  const from = params.from && !Number.isNaN(Date.parse(params.from)) ? new Date(params.from) : null;
  const to = params.to && !Number.isNaN(Date.parse(params.to)) ? new Date(`${params.to}T23:59:59.999`) : null;
  if (from || to) filters.push({ [type === "FOUND" ? "foundAt" : "lostAt"]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });

  const base = { deletedAt: null, status: "ACTIVE" as const, moderation: "APPROVED" as const, AND: filters };
  const foundWhere = base as Prisma.FoundItemWhereInput;
  const lostWhere = base as Prisma.LostItemWhereInput;
  const relevantFetch = sort === "relevance" ? Math.min(page * pageSize + 1, 1000) : pageSize + 1;
  const skip = sort === "relevance" ? 0 : (page - 1) * pageSize;
  const take = sort === "relevance" ? relevantFetch : pageSize + 1;
  const orderBy = type === "FOUND" ? { foundAt: sort === "oldest" ? "asc" as const : "desc" as const } : { lostAt: sort === "oldest" ? "asc" as const : "desc" as const };
  const [foundRows, lostRows, total] = type === "FOUND" ? await Promise.all([
    prisma.foundItem.findMany({ where: foundWhere, orderBy, skip, take, include: { images: { select: { id: true, url: true } }, category: { select: { name: true } } } }),
    Promise.resolve([] as never[]),
    prisma.foundItem.count({ where: foundWhere }),
  ]) : await Promise.all([
    Promise.resolve([] as never[]),
    prisma.lostItem.findMany({ where: lostWhere, orderBy, skip, take, include: { images: { select: { id: true, url: true } }, category: { select: { name: true } } } }),
    prisma.lostItem.count({ where: lostWhere }),
  ]);
  let reports = type === "FOUND"
    ? foundRows.map((report) => ({ ...report, type: "FOUND" as const, occurredAt: report.foundAt }))
    : lostRows.map((report) => ({ ...report, type: "LOST" as const, occurredAt: report.lostAt }));
  if (sort === "relevance") {
    reports.sort((a, b) => searchRelevance(query, [b.title, b.brand, b.model, b.category.name, b.description, b.subcategory]) - searchRelevance(query, [a.title, a.brand, a.model, a.category.name, a.description, a.subcategory]) || b.createdAt.getTime() - a.createdAt.getTime());
    reports = reports.slice((page - 1) * pageSize, page * pageSize);
  } else reports = reports.slice(0, pageSize);

  const values = {
    q: query,
    type,
    category: params.category && ITEM_CATEGORIES.includes(params.category as (typeof ITEM_CATEGORIES)[number]) ? params.category : "",
    sort,
    location: params.location?.slice(0, 100) ?? "",
    from: from ? from.toISOString().slice(0, 10) : "",
    to: to ? params.to ?? "" : "",
  };
  const lastPage = Math.min(maxPage, Math.ceil(Math.min(total, maxPage * pageSize) / pageSize));

  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width search-items-page">
    <p className="eyebrow">Community listings</p>
    <h1 className="page-title">Search Items</h1>
    <p className="page-intro">Browse approved {type === "FOUND" ? "found" : "lost"} reports. Private ownership details and contact information are not shown.</p>
    <SearchControls key={JSON.stringify(values)} values={values} count={total} />
    {reports.length ? <section className="search-items-grid" aria-label={`${type === "FOUND" ? "Found" : "Lost"} item results`}>
      {reports.map((report) => <Link href={`/items/${report.type.toLowerCase()}/${report.id}`} className="search-item-card" key={`${report.type}-${report.id}`} aria-label={`${report.type === "FOUND" ? "Found" : "Lost"}: ${report.title}, ${report.category.name}, ${report.location}`}>
        <span className={`search-item-image-wrap${report.images[0] ? "" : " is-placeholder"}`}>
          {report.images[0] ? <Image src={report.images[0].url} alt="" fill sizes="(max-width: 650px) 32vw, (max-width: 1100px) 20vw, 16vw" className="search-item-image" unoptimized /> : <span aria-hidden="true">✳</span>}
          <span className={`report-kind report-kind-${report.type.toLowerCase()}`}>{report.type === "FOUND" ? "Found" : "Lost"}</span>
        </span>
        <span className="search-item-card-copy"><strong>{report.title}</strong><span>{report.category.name}</span><span className="search-item-location">{report.location}</span></span>
      </Link>)}
    </section> : <section className="empty-state search-items-empty" aria-labelledby="empty-title"><span className="empty-symbol" aria-hidden="true">⌕</span><p className="eyebrow">No {type.toLowerCase()} items found</p><h2 id="empty-title">There are no matching public reports yet.</h2><p>{query ? "Try a shorter search, another spelling, or clear a filter. Reports appear after review." : "New reports remain private to their owner while pending review."}</p><div className="button-row"><Link className="button button-primary" href="/report/lost">Report lost</Link><Link className="button button-outline" href="/report/found">Report found</Link></div></section>}
    {lastPage > 1 && <nav className="search-pagination" aria-label="Search result pages">{page > 1 && <Link className="button button-outline" href={pageHref(values, page - 1)}>Previous</Link>}<span>Page {page} of {lastPage}</span>{page < lastPage && <Link className="button button-outline" href={pageHref(values, page + 1)}>Next</Link>}</nav>}
  </main><SiteFooter /></div>;
}

function pageHref(values: { q: string; type: string; category: string; sort: string; location: string; from: string; to: string }, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...values, page: String(page) })) if (value && !(key === "sort" && value === "newest")) params.set(key, value);
  return `/items?${params.toString()}`;
}
