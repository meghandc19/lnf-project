import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

const stages = [
  ["01", "Report an item", "Describe what was lost or found, when, and in a general area. Reporting forms are still being developed."],
  ["02", "Browse community reports", "Search and filters will help people compare real reports. Item listings and search are not available yet."],
  ["03", "Arrange a careful handover", "When the claim and contact tools are ready, people will be able to coordinate a return. For now, use public places and protect your private details."],
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
        <div className="notice-card"><strong>Current status</strong><p>Item reports, search, matching, claims, and handover tools are not live yet. No report can be submitted or found through REVOK today.</p></div>
        <div className="button-row"><Link className="button button-primary" href="/register">Create an account <span aria-hidden="true">↗</span></Link><Link className="button button-outline" href="/items">View current listings</Link></div>
      </main>
      <SiteFooter />
    </div>
  );
}
