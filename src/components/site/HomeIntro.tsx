"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const FADE_DURATION_MS = 850;
const INTRO_END_SECONDS = 5;

export default function HomeIntro({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const [playingIntro, setPlayingIntro] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload") return;
    const frame = window.requestAnimationFrame(() => setPlayingIntro(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!playingIntro) return;
    const video = videoRef.current;
    if (!video) return;
    finishedRef.current = false;
    void video.play().catch(() => finishIntro());
  }, [playingIntro]);

  function finishIntro() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    videoRef.current?.pause();
    setRevealing(true);
    window.setTimeout(() => {
      setPlayingIntro(false);
      setRevealing(false);
    }, FADE_DURATION_MS);
  }

  return <>
    <div className={`home-intro-stage${playingIntro && !revealing ? " is-intro-playing" : ""}${revealing ? " is-intro-revealing" : ""}`} inert={playingIntro && !revealing}>
      {children}
    </div>
    {playingIntro && <div className={`home-intro-overlay${revealing ? " is-fading" : ""}`}>
      <div className="home-intro-video-viewport">
        <video ref={videoRef} src="/vid/bg.mp4" autoPlay muted playsInline preload="auto" onEnded={finishIntro} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= INTRO_END_SECONDS) finishIntro(); }} onError={finishIntro} aria-hidden="true" />
      </div>
      <button className="home-intro-skip" type="button" onClick={finishIntro}>Skip intro</button>
    </div>}
  </>;
}
