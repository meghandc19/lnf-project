import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

const stages = [
  ["01", "Report an item", "Share what was lost or found, when, and in a general public area. Reports stay private until approved."],
  ["02", "Browse community reports", "Search approved active reports by type, category, keywords, location, and date. Possible matches are suggestions to review carefully."],
  ["03", "Send a claim request", "For a found item, explain privately why you believe it belongs to you. The finder can review your request from their dashboard. In-app replies and handover tools are not available yet."],
];

export default function HowItWorksPage() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width">
        <p className="eyebrow">How it works</p>
        <h1 className="page-title">A clear path from lost to found.</h1>
        <p className="page-intro">REVOK is being built around a simple idea: make it easier for people in the same community to help each other find misplaced belongings.</p>
        <div className="process-list">
          {stages.map(([number, title, description]) => (
            <article className="process-card" key={number}>
              <span className="process-number">{number}</span>
              <div><h2>{title}</h2><p>{description}</p></div>
            </article>
          ))}
        </div>
        <div className="notice-card"><strong>Current status</strong><p>Approved reports, Search Items, possible match suggestions, and claim requests are available. In-app messaging and steward handovers are still in development.</p></div>
        <div className="button-row"><Link className="button button-primary" href="/register">Create an account <span aria-hidden="true">↗</span></Link><Link className="button button-outline" href="/items">Search Items</Link></div>
      </main>
      <SiteFooter />
    </div>
  );
}
