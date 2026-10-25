import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (type !== "lost" && type !== "found") notFound();

  const isLost = type === "lost";
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="subpage-main page-width">
        <p className="eyebrow">{isLost ? "Report a lost item" : "Report a found item"}</p>
        <h1 className="page-title">{isLost ? "Tell your community what went missing." : "Help someone find what they lost."}</h1>
        <p className="page-intro">We’re preparing a secure reporting flow with clear item details, general locations, and server-side account checks.</p>
        <section className="empty-state report-state">
          <span className="empty-symbol" aria-hidden="true">✳</span>
          <p className="eyebrow">Reporting is coming soon</p>
          <h2>No report has been submitted.</h2>
          <p>The reporting API and secure image storage are not implemented yet. This page does not collect or save item details.</p>
          <div className="button-row">
            <Link className="button button-primary" href="/how-it-works">See how it will work</Link>
            <Link className="button button-outline" href="/">Back to home</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
