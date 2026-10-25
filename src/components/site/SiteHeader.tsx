import Image from "next/image";
import Link from "next/link";
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
          <Image src="/img/revok-logo.png" width={52} height={52} alt="" priority className="brand-logo" />
          <span>REVOK</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/items">Search lost items</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/about">About</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link href="/dashboard" className="header-dashboard">Dashboard</Link>
              <Link href="/profile" className="header-profile" aria-label={`Edit ${user.name}'s profile`}>
                {user.image ? <Image src={user.image} width={34} height={34} alt="" unoptimized referrerPolicy="no-referrer" /> : <span aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>}
                <span className="header-profile-name">{user.name}</span>
              </Link>
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
