import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getAuthenticatedUser } from "@/lib/auth/guards";

const steps = [
  { number: "01", icon: "📷", title: "Report what happened", text: "Post a lost or found report with a clear description and a general public location. New reports stay private while they are reviewed." },
  { number: "02", icon: "🔎", title: "Search approved reports", text: "Filter public reports by lost or found, category, words, place, and date. Private ownership details never appear in search." },
  { number: "03", icon: "✨", title: "Save an item to watch", text: "Add something you own to your private inventory. When a new found report looks similar, REVOK can send you a potential-match notification." },
  { number: "04", icon: "💬", title: "Claim and talk privately", text: "Send a claim with details that help show the item is yours. The finder can review it and discuss the return in the private REVOK conversation." },
  { number: "05", icon: "🤝", title: "Choose a safe handover", text: "After a claim is approved, arrange the return. The finder confirms it with the one-time recovery code. A finder can also request a REVOK Steward to take custody." },
  { number: "06", icon: "🛡️", title: "Keep the community safe", text: "Keep personal contact details and sensitive information out of public reports. Report a concern from a claim conversation; the REVOK team reviews reports and can restrict unsafe accounts." },
];

export default async function HowItWorksPage() {
  const user = await getAuthenticatedUser();

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width how-it-works-page">
        <header className="journey-intro">
          <p className="eyebrow">How REVOK works</p>
          <h1 className="page-title">From lost, to found, to safely home.</h1>
          <p className="page-intro">A simple path for neighbors to help return belongings, with privacy and clear steps at every stage.</p>
        </header>

        <ol className="journey-steps" aria-label="The REVOK return process">
          {steps.map((step) => (
            <li className="journey-step" key={step.number}>
              <span className="journey-step-icon" aria-hidden="true">{step.icon}</span>
              <span className="journey-step-number">STEP {step.number}</span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <section className="journey-privacy" aria-label="Privacy and review">
          <span aria-hidden="true">🔒</span>
          <div><h2>Private while reviewed. Public when approved.</h2><p>Claim details stay in the conversation. Reports become searchable only after approval, and personal contact information should stay private.</p></div>
        </section>

        <div className="button-row journey-actions">
          {!user && <Link className="button button-primary" href="/register">Create an account <span aria-hidden="true">↗</span></Link>}
          <Link className="button button-outline" href="/items">Search Items</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
