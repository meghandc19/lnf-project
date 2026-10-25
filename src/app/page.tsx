import Image from "next/image";
import Link from "next/link";
import heroBanner from "../../public/img/web banner.png";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { requireCanBrowse } from "@/lib/auth/guards";

const actions = [
  { href: "/report/lost", number: "01", title: "Report lost", description: "Tell the community what you’re looking for.", icon: "lost" },
  { href: "/report/found", number: "02", title: "Report found", description: "Help a lost belonging find its person.", icon: "found" },
  { href: "/items", number: "03", title: "Search lost item", description: "Look through community reports.", icon: "search" },
];

function ActionIcon({ name }: { name: string }) {
  if (name === "lost") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M10.8 7.8v6M7.8 10.8h6"/></svg>;
  if (name === "found") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10 4.5a1.5 1.5 0 0 1 3 0V10 5.5a1.5 1.5 0 0 1 3 0v6l.7-1.2a1.7 1.7 0 0 1 3 1.7l-2.1 4.7A6 6 0 0 1 13.1 21h-1.4a6 6 0 0 1-4.8-2.4L3.4 14a1.8 1.8 0 0 1 2.8-2.2L9 15"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>;
}

export default async function Home() {
  let signedIn = false;
  try {
    await requireCanBrowse();
    signedIn = true;
  } catch {
    // Keep the home page public when there is no permitted session.
  }

  return (
    <div className="site-page">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <Image src={heroBanner} alt="A green REVOK backpack resting on a sunlit campus bench" fill priority sizes="100vw" className="hero-image" />
          <div className="hero-overlay" />
          <div className="hero-content page-width">
            <p className="eyebrow"><span className="eyebrow-dot" /> A community that brings things back</p>
            <h1>Lost something?<br /><span>Let’s find its way home.</span></h1>
            <p className="hero-description">A little kindness can turn a lost moment into a found connection.</p>
            <div className="hero-actions">
              <Link href="/report/lost" className="button button-primary button-large hero-action"><ActionIcon name="lost" /><span>Report lost</span></Link>
              <Link href="/report/found" className="button button-light button-large hero-action"><ActionIcon name="found" /><span>Report found</span></Link>
              <Link href="/items" className="button button-light button-large hero-action"><ActionIcon name="search" /><span>Search lost item</span></Link>
            </div>
            <div className="hero-word-line" aria-label="Lost. Found. Back together.">
              <span className="hero-word-static">Every lost thing deserves a way back.</span>
              <span className="hero-word-lens" aria-hidden="true"><span className="hero-word-rotator"><span>Lost.</span><span>Found.</span><span>Back together.</span></span></span>
            </div>
          </div>
          <div className="hero-caption" aria-hidden="true"><span className="caption-symbol">✳</span><span>Look out for each other.<br /><strong>Bring a little good home.</strong></span></div>
        </section>

        <section className="quick-actions page-width" aria-labelledby="quick-actions-title">
          <div className="quick-actions-heading">
            <p className="eyebrow">What brings you here?</p>
            <h2 id="quick-actions-title">Start with one small step.</h2>
          </div>
          <div className="quick-actions-grid">
            {actions.map((action) => (
              <Link className="quick-action-card" href={action.href} key={action.number}>
                <span className="quick-action-number">{action.number}</span>
                <span className="quick-action-icon"><ActionIcon name={action.icon} /></span>
                <span className="quick-action-copy"><strong>{action.title}</strong><span>{action.description}</span></span>
                <span className="quick-action-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
          <p className="quick-actions-note"><span aria-hidden="true">●</span> Lost and found reports can now be saved to your account. Public browsing shows reports after review.</p>
        </section>

        <section className="intro-section page-width" aria-labelledby="intro-title">
          <div className="section-lead">
            <p className="eyebrow">A little more care, together</p>
            <h2 id="intro-title">The things we carry<br /><span>carry a little meaning too.</span></h2>
          </div>
          <div className="intro-copy">
            <p>REVOK is a community lost-and-found space in the making. We’re building a thoughtful way to share what’s missing, return what’s found, and keep personal details private.</p>
            <Link className="text-link" href="/how-it-works">See how REVOK will work <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="availability-band" aria-label="Current availability">
          <div className="availability-icon" aria-hidden="true">i</div>
          <div><strong>Reports stay connected to your account.</strong><p>Submit a lost or found report and follow its review status from your dashboard. Approved reports can be browsed by the community.</p></div>
          <Link href="/how-it-works" className="text-link">The process <span aria-hidden="true">→</span></Link>
        </section>

        <section className="steps-section page-width" aria-labelledby="steps-title">
          <div className="section-heading-row">
            <div><p className="eyebrow">Clear, careful, community-led</p><h2 id="steps-title">A simple path back.</h2></div>
            <p>Reports are saved to member accounts and reviewed before they appear in public browsing. Matching and handovers are still in development.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card"><span className="step-number">01</span><div className="step-rule"/><h3>Share what’s missing</h3><p>A helpful report will give your community enough detail to recognize an item.</p></article>
            <article className="step-card"><span className="step-number">02</span><div className="step-rule"/><h3>Look through real reports</h3><p>Search and filters will make it easier to find a possible connection.</p></article>
            <article className="step-card"><span className="step-number">03</span><div className="step-rule"/><h3>Reconnect thoughtfully</h3><p>Protect personal details and choose a public place for a handover.</p></article>
          </div>
          <div className="steps-action"><Link href="/how-it-works" className="button button-outline">More about the process <span aria-hidden="true">→</span></Link></div>
        </section>

        <section className="safety-section"><div className="safety-inner page-width"><div className="safety-emblem" aria-hidden="true">✳</div><div className="safety-copy"><p className="eyebrow">A little care goes a long way</p><h2>Keep the handover safe and simple.</h2><p>Share only details needed to identify an item. Avoid posting private contact information or precise home locations, and meet in a public place if you arrange a handover.</p></div><Link href="/about" className="button button-light">Our community principles <span aria-hidden="true">→</span></Link></div></section>

        <section className="closing-section page-width"><div><p className="eyebrow">Be part of what we’re building</p><h2>Let’s make lost feel a little less alone.</h2></div><div className="closing-actions">{signedIn ? <><Link href="/dashboard" className="button button-primary">Go to dashboard <span aria-hidden="true">↗</span></Link><Link href="/profile" className="text-link">Edit your profile</Link></> : <><Link href="/register" className="button button-primary">Join the community <span aria-hidden="true">↗</span></Link><Link href="/login" className="text-link">Already registered? Log in</Link></>}</div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
