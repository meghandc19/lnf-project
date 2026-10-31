import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

export default function AboutPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width">
        <p className="eyebrow">About REVOK</p>
        <h1 className="page-title">A community project built around looking out for one another.</h1>
        <p className="page-intro">REVOK is a lost and found application being developed for VTU subject 1BCP308. The goal is to give communities a clear place to share lost and found reports and help belongings get back to their owners.</p>
        <section className="principles-grid" aria-label="Community principles">
          <article><span className="principle-number">01</span><h2>Be useful</h2><p>Keep reports clear and focused on details that help identify an item.</p></article>
          <article><span className="principle-number">02</span><h2>Respect privacy</h2><p>Avoid publishing private contact information or precise home locations.</p></article>
          <article><span className="principle-number">03</span><h2>Use good judgment</h2><p>Potential matches are only a starting point. Confirm details carefully and meet in a public place.</p></article>
        </section>
        <div className="notice-card"><strong>What is available today?</strong><p>Members can submit reports, search approved active items, see possible matches on lost reports, and send claim requests. Private in-app replies and steward handovers are still in development.</p></div>
        <Link className="text-link" href="/how-it-works">See how REVOK is planned to work <span aria-hidden="true">→</span></Link>
      </main>
      <SiteFooter />
    </div>
  );
}
