import Link from "next/link";
import HomeIllustration from "@/components/site/HomeIllustration";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

function ActionIcon({ name }: { name: string }) {
  if (name === "lost") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M10.8 7.8v6M7.8 10.8h6"/></svg>;
  if (name === "found") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10 4.5a1.5 1.5 0 0 1 3 0V10 5.5a1.5 1.5 0 0 1 3 0v6l.7-1.2a1.7 1.7 0 0 1 3 1.7l-2.1 4.7A6 6 0 0 1 13.1 21h-1.4a6 6 0 0 1-4.8-2.4L3.4 14a1.8 1.8 0 0 1 2.8-2.2L9 15"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>;
}

export default function Home() {
  return (
    <div className="site-page">
      <SiteHeader home />
      <main>
        <section className="home-hero-section">
          <div className="home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-hero-eyebrow"><span aria-hidden="true" />A community that brings things back</p>
              <h1><span>Lost something?</span><span>Let’s find its way home.</span></h1>
              <p className="home-hero-description">A little kindness can turn a lost moment into a found connection.</p>
              <div className="home-hero-actions">
                <Link href="/report/lost" className="button button-primary button-large home-hero-action"><ActionIcon name="lost" /><span>Report lost</span></Link>
                <Link href="/report/found" className="button button-light button-large home-hero-action"><ActionIcon name="found" /><span>Report found</span></Link>
                <Link href="/items" className="button button-light button-large home-hero-action"><ActionIcon name="search" /><span>Search Items</span></Link>
              </div>
              <p className="home-hero-note">Every lost thing deserves a way back.</p>
            </div>
            <HomeIllustration />
          </div>
          <svg className="home-hero-wave" viewBox="0 0 1600 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 42C180 82 290 82 465 45S760 7 928 46s278 56 422 9 190-52 250-45v90H0Z" fill="currentColor"/><path d="M0 63c200-38 314 52 500 24s272-88 460-49 260 52 403 12 188-34 237-23v73H0Z" fill="currentColor" opacity=".55"/></svg>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
