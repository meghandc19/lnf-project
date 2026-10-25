import Image from "next/image";
import Link from "next/link";
import AccountMenu from "@/components/site/AccountMenu";
import { requireCanBrowse } from "@/lib/auth/guards";

export default async function SiteHeader() {
  let user = null;
  try {
    user = await requireCanBrowse();
  } catch {
    // Public navigation remains available when there is no active session.
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="REVOK home">
          <Image src="/img/revok-logo.png" width={68} height={68} alt="" priority className="brand-logo" />
          <span>REVOK</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/items">Search lost items</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/about">About</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link href="/dashboard" className="header-dashboard">Dashboard</Link>
              <AccountMenu name={user.name} username={user.username} phoneNumber={user.phoneNumber} image={user.image} />
            </>
          ) : (
            <>
              <Link href="/login" className="button button-quiet">Log in</Link>
              <Link href="/register" className="button button-small button-primary">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
