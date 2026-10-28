"use client";

import { useEffect, useRef, useState } from "react";

const REVEAL_AT_SECONDS = 4.42;
const FINISHING_AT_SECONDS = 4.65;
const SKIP_TRANSITION_MS = 850;

type IntroState = "playing" | "revealing" | "settled";

export default function IntroAnimation() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const exitTimerRef = useRef<number | null>(null);
  const revealStartedRef = useRef(false);
  const settledRef = useRef(false);
  const previousOverflowRef = useRef("");
  const [state, setState] = useState<IntroState>("playing");
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const video = videoRef.current;
    if (video) {
      void video.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
    }

    return () => {
      document.body.style.overflow = previousOverflowRef.current;
      delete document.documentElement.dataset.revokIntro;
      delete document.documentElement.dataset.revokIntroSkipped;
      video?.pause();
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  function settleIntro() {
    if (settledRef.current) return;
    settledRef.current = true;
    setState("settled");
    document.documentElement.dataset.revokIntro = "settled";
    document.body.style.overflow = previousOverflowRef.current;
    videoRef.current?.pause();
  }

  function beginReveal(wasSkipped = false) {
    if (revealStartedRef.current || settledRef.current) return;
    revealStartedRef.current = true;
    setState("revealing");
    setSkipped(wasSkipped);
    document.documentElement.dataset.revokIntro = "revealing";
    if (wasSkipped) {
      document.documentElement.dataset.revokIntroSkipped = "true";
      videoRef.current?.pause();
      exitTimerRef.current = window.setTimeout(settleIntro, SKIP_TRANSITION_MS);
    }
  }

  return (
    <div className="intro-animation" data-state={state} data-skipped={skipped ? "true" : undefined}>
      <video
        ref={videoRef}
        className="intro-animation-video"
        muted
        playsInline
        preload="auto"
        poster="/vid/video-poster.jpg"
        aria-label="REVOK opening animation"
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          if (time >= REVEAL_AT_SECONDS) beginReveal();
          if (time >= FINISHING_AT_SECONDS && revealStartedRef.current && !settledRef.current) {
            document.documentElement.dataset.revokIntro = "finishing";
          }
        }}
        onEnded={() => {
          if (!revealStartedRef.current) beginReveal();
          settleIntro();
        }}
        onError={() => beginReveal(true)}
      >
        <source src="/vid/video.mp4" type="video/mp4" />
      </video>
      <div className="intro-animation-controls">
        {playbackBlocked && (
          <button type="button" onClick={() => { void videoRef.current?.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true)); }}>
            Play intro
          </button>
        )}
        {state === "playing" && (
          <button type="button" onClick={() => beginReveal(true)}>
            Skip intro <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
