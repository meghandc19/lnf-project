"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResponsiveNav({ authenticated }: { authenticated: boolean }) {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="site-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" className={open ? "menu-icon is-open" : "menu-icon"}><i /><i /><i /></span>
      </button>
      <nav id="site-navigation" className={`main-nav${open ? " is-open" : ""}`} aria-label="Main navigation">
        <Link href="/" onClick={closeMenu}>Home</Link>
        <Link href="/items" onClick={closeMenu}>Search Items</Link>
        <Link href="/how-it-works" onClick={closeMenu}>How it works</Link>
        <Link href="/about" onClick={closeMenu}>About</Link>
        {authenticated ? <Link href="/dashboard" className="mobile-only-nav-link" onClick={closeMenu}>Dashboard</Link> : <>
          <Link href="/login" className="mobile-only-nav-link" onClick={closeMenu}>Log in</Link>
          <Link href="/register" className="mobile-only-nav-link" onClick={closeMenu}>Create account</Link>
        </>}
      </nav>
    </>
  );
}
