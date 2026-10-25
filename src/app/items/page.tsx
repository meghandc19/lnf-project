import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

export default function ItemsPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width">
        <p className="eyebrow">Find items</p>
        <h1 className="page-title">Look for what matters to you.</h1>
        <p className="page-intro">Searchable lost and found reports will appear here when item reporting and search are connected.</p>
        <section className="empty-state" aria-labelledby="empty-title">
          <span className="empty-symbol" aria-hidden="true">⌕</span>
          <p className="eyebrow">No listings yet</p>
          <h2 id="empty-title">Real reports will show up here.</h2>
          <p>There are no item listings to browse right now. Search and filters are not active, so we won’t show sample or made-up reports.</p>
          <div className="button-row">
            <Link className="button button-primary" href="/how-it-works">How it will work <span aria-hidden="true">→</span></Link>
            <Link className="button button-outline" href="/">Back to home</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
