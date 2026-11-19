"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./ResponsiveNav.module.css";

export default function ResponsiveNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname() ?? "";
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) {
        setOpenForPath(null);
      }
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenForPath(null);
    }
    function dismissOnDesktop() {
      if (window.matchMedia("(min-width: 841px)").matches) setOpenForPath(null);
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    window.addEventListener("resize", dismissOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
      window.removeEventListener("resize", dismissOnDesktop);
    };
  }, [open]);

  function linkClass(href: string) {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return `${styles.link}${active ? ` ${styles.activeLink}` : ""}`;
  }

  return (
    <div className={styles.navShell} ref={navRef}>
      <button
        className={styles.toggle}
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="site-navigation"
        onClick={() => setOpenForPath((current) => current === pathname ? null : pathname)}
      >
        <span aria-hidden="true" className={`${styles.menuIcon}${open ? ` ${styles.isOpen}` : ""}`}>
          <i /><i /><i />
        </span>
      </button>
      <nav
        id="site-navigation"
        className={`${styles.nav}${open ? ` ${styles.navOpen}` : ""}`}
        aria-label="Main navigation"
      >
        <Link href="/" className={linkClass("/")} aria-current={pathname === "/" ? "page" : undefined} onClick={() => setOpenForPath(null)}>Home</Link>
        <Link href="/items" className={linkClass("/items")} aria-current={pathname.startsWith("/items") ? "page" : undefined} onClick={() => setOpenForPath(null)}>Search Items</Link>
        <Link href="/how-it-works" className={linkClass("/how-it-works")} aria-current={pathname === "/how-it-works" ? "page" : undefined} onClick={() => setOpenForPath(null)}>How it works</Link>
        <Link href="/about" className={linkClass("/about")} aria-current={pathname === "/about" ? "page" : undefined} onClick={() => setOpenForPath(null)}>About</Link>
        {authenticated ? (
          <Link href="/dashboard" className={`${linkClass("/dashboard")} ${styles.mobileLink}`} aria-current={pathname.startsWith("/dashboard") ? "page" : undefined} onClick={() => setOpenForPath(null)}>Dashboard</Link>
        ) : (
          <>
            <Link href="/login" className={`${linkClass("/login")} ${styles.mobileLink}`} aria-current={pathname === "/login" ? "page" : undefined} onClick={() => setOpenForPath(null)}>Log in</Link>
            <Link href="/register" className={`${linkClass("/register")} ${styles.mobileLink}`} aria-current={pathname === "/register" ? "page" : undefined} onClick={() => setOpenForPath(null)}>Create account</Link>
          </>
        )}
      </nav>
    </div>
  );
}
