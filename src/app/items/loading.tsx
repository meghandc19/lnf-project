import SiteHeader from "@/components/site/SiteHeader";

export default function ItemsLoading() {
  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width" aria-busy="true" aria-label="Loading item reports"><div className="eyebrow">Find items</div><div className="loading-line loading-title" /><div className="loading-line loading-search" /><div className="report-list">{Array.from({ length: 4 }, (_, index) => <article className="public-report-card report-skeleton" key={index}><div className="public-report-image" /><div className="public-report-content"><div className="loading-line" /><div className="loading-line loading-title" /><div className="loading-line" /></div></article>)}</div></main></div>;
}
