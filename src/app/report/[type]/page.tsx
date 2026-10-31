import { notFound } from "next/navigation";
import Link from "next/link";
import ReportForm from "@/components/reports/ReportForm";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { requireCanBrowse } from "@/lib/auth/guards";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (type !== "lost" && type !== "found") notFound();

  const isLost = type === "lost";
  let user = null;
  try {
    user = await requireCanBrowse();
  } catch {
    // Keep the reporting explanation accessible while submission stays protected.
  }
  const canReport = user?.status === "ACTIVE" && user.phoneNumberVerified;
  return (
    <div className="site-page">
      <SiteHeader />
      <main className={`subpage-main report-page-main page-width${isLost ? " report-page-main-lost" : ""}`}>
        {isLost ? <>
          <h1 className="page-title">Report Lost Item</h1>
          <p className="page-intro">Share a few details to help someone recognize your lost item.</p>
        </> : <div className="found-page-heading">
          <Link href="/" className="found-back-link">← Back to home</Link>
          <p className="eyebrow">Report a found item</p>
          <h1 className="page-title">Report a Found Item</h1>
          <p className="page-intro">Found something that belongs to someone else? Help return it safely.</p>
        </div>}
        {canReport ? <section className={`report-card${isLost ? " report-card-lost" : ""}`}><ReportForm type={isLost ? "LOST" : "FOUND"} /></section> : (
          <section className="empty-state report-state">
            <span className="empty-symbol" aria-hidden="true">✳</span>
            <p className="eyebrow">{user ? "One more step" : "Sign in to report"}</p>
            <h2>{!user ? "Your report will be saved to your account." : user.status !== "ACTIVE" ? "Reporting is unavailable for this account." : "Verify your phone to submit a report."}</h2>
            <p>{!user ? "Sign in or create an account first. You’ll be able to return to this report after signing in." : user.status !== "ACTIVE" ? "Restricted accounts can browse, but cannot submit lost or found reports." : "A verified phone number is required before submitting lost or found items."}</p>
            <div className="button-row">
              {!user ? <><Link className="button button-primary" href={`/login?callbackURL=/report/${type}`}>Log in</Link><Link className="button button-outline" href="/register">Create account</Link></> : user.status === "ACTIVE" ? <Link className="button button-primary" href="/register/complete">Verify phone</Link> : null}
              <Link className="button button-outline" href="/">Back to home</Link>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
