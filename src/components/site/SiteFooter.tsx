import Link from "next/link";
import Image from "next/image";
import { requireCanBrowse } from "@/lib/auth/guards";

export default async function SiteFooter() {
  let signedIn = false;
  try {
    await requireCanBrowse();
    signedIn = true;
  } catch {
    // Keep public footer links available without an allowed session.
  }

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand-block">
          <Link href="/" className="brand" aria-label="REVOK home">
            <Image src="/img/revok-logo.png" width={46} height={46} alt="" className="brand-logo" />
            <span>REVOK</span>
          </Link>
          <p>A thoughtful place to reconnect people with the things they have lost.</p>
        </div>
        <div className="footer-links">
          <strong>Explore</strong>
          <Link href="/items">Search Items</Link>
          <Link href="/report/lost">Report lost</Link>
          <Link href="/report/found">Report found</Link>
        </div>
        <div className="footer-links">
          <strong>Learn</strong>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/about">About REVOK</Link>
          <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Your dashboard" : "Your account"}</Link>
        </div>
        <div className="footer-safety">
          <span className="footer-safety-icon" aria-hidden="true">◎</span>
          <strong>Meet thoughtfully</strong>
          <p>When arranging a handover, choose a public place and keep private details to yourself.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} REVOK</span>
        <span>Made for our community.</span>
      </div>
    </footer>
  );
}
