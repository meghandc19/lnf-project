"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useInitialRoutePath } from "@/components/site/RoutePathTracker";

declare global {
  interface Window {
    __revokHomeIntroAttempted?: boolean;
  }
}

type LogoTarget = { left: number; top: number; width: number; height: number };

export default function HomeIntro() {
  const initialPath = useInitialRoutePath();
  const introStarted = useRef(false);
  const [visible, setVisible] = useState(() =>
    typeof window === "undefined" ||
    (initialPath === "/" && !window.__revokHomeIntroAttempted),
  );
  const [moving, setMoving] = useState(false);
  const [fading, setFading] = useState(false);
  const [target, setTarget] = useState<LogoTarget | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isHomeEntry = initialPath === "/";
    const isReload = navigation?.type === "reload";
    if (!isHomeEntry || (window.__revokHomeIntroAttempted && !introStarted.current) || (!isReload && navigation?.type !== "navigate")) {
      const hideFrame = window.requestAnimationFrame(() => setVisible(false));
      return () => window.cancelAnimationFrame(hideFrame);
    }

    introStarted.current = true;
    window.__revokHomeIntroAttempted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const hideFrame = window.requestAnimationFrame(() => setVisible(false));
      return () => window.cancelAnimationFrame(hideFrame);
    }

    const finish = () => {
      setFading(true);
      hideTimer.current = window.setTimeout(() => setVisible(false), 240);
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const logo = document.querySelector<HTMLElement>(".site-header-home .brand-logo");
        if (logo) {
          const rect = logo.getBoundingClientRect();
          setTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
          setMoving(true);
        }
      });
    });
    const finishTimer = window.setTimeout(finish, 3300);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(finishTimer);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [initialPath]);

  if (!visible) return null;

  const logoStyle = target
    ? ({
        "--intro-left": `${target.left}px`,
        "--intro-top": `${target.top}px`,
        "--intro-width": `${target.width}px`,
        "--intro-height": `${target.height}px`,
    } as CSSProperties)
    : undefined;

  return (
    <div className={`home-intro-overlay${moving ? " is-moving" : ""}${fading ? " is-fading" : ""}`}>
      <Image
        src="/img/revok-logo.png"
        alt=""
        width={360}
        height={360}
        priority
        className="home-intro-logo"
        style={logoStyle}
      />
      <button className="home-intro-skip" type="button" onClick={() => {
        if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        setFading(true);
        hideTimer.current = window.setTimeout(() => setVisible(false), 240);
      }}>
        Skip intro
      </button>
    </div>
  );
}
