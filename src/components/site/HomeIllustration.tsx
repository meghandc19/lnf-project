export default function HomeIllustration() {
  return (
    <div className="home-illustration" aria-hidden="true">
      <svg viewBox="0 0 620 520" role="presentation">
        <defs>
          <radialGradient id="home-halo" cx="50%" cy="48%" r="52%"><stop offset="0" stopColor="#d9f2e1" stopOpacity=".94"/><stop offset=".7" stopColor="#e8f7ec" stopOpacity=".8"/><stop offset="1" stopColor="#edf8f0" stopOpacity="0"/></radialGradient>
          <linearGradient id="home-fold-a" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fafffb"/><stop offset="1" stopColor="#bde7cb"/></linearGradient>
          <linearGradient id="home-fold-b" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9f1e0"/><stop offset="1" stopColor="#a7dbb7"/></linearGradient>
          <linearGradient id="home-plane" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#78d69a"/><stop offset="1" stopColor="#00a154"/></linearGradient>
          <filter id="home-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#0b5833" floodOpacity=".14"/></filter>
          <path id="home-flight-path" d="M65 112 C126 76 198 83 240 119 S320 172 362 145 C407 116 461 118 481 151 S499 187 532 202" />
        </defs>

        <circle cx="343" cy="275" r="238" fill="url(#home-halo)" />
        <circle cx="344" cy="275" r="183" fill="none" stroke="#e1f2e6" strokeWidth="1" />
        <circle cx="344" cy="275" r="210" fill="none" stroke="#e7f4ea" strokeWidth="1" strokeDasharray="2 9" />

        <use href="#home-flight-path" className="home-flight-trail" fill="none" stroke="#83bd96" strokeWidth="2" strokeDasharray="5 9" strokeLinecap="round" />
        <g className="home-plane-motion">
          <path d="M-18-10 20 0-10 16-5 3Z" fill="url(#home-plane)" stroke="#087844" strokeWidth="2" strokeLinejoin="round" />
          <path d="m-5 3 25-3-30 16Z" fill="#21b96a" stroke="#087844" strokeWidth="1.5" strokeLinejoin="round" />
          <animateMotion dur="19s" repeatCount="indefinite" rotate="auto" keyPoints="0;1;1" keyTimes="0;.88;1" calcMode="linear"><mpath href="#home-flight-path" /></animateMotion>
          <animate attributeName="opacity" dur="19s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.06;.86;1" />
        </g>
        <g className="home-plane-still" transform="translate(65 112) rotate(-12)">
          <path d="M-18-10 20 0-10 16-5 3Z" fill="url(#home-plane)" stroke="#087844" strokeWidth="2" strokeLinejoin="round" />
          <path d="m-5 3 25-3-30 16Z" fill="#21b96a" stroke="#087844" strokeWidth="1.5" strokeLinejoin="round" />
        </g>

        <g className="home-map" filter="url(#home-shadow)">
          <path d="m76 337 53-128 101-30 85 26 91-36 99 28 45 130-103 29-91-19-94 33-91-24-78 16Z" fill="#fff" stroke="#a8d9b6" strokeWidth="3" strokeLinejoin="round" />
          <path d="m129 209 72-18 31 98-77 17-47 31Z" fill="url(#home-fold-a)" />
          <path d="m201 191 57 15 2 101-28-18Z" fill="#c7e9d0" />
          <path d="m258 206 57 20-2 115-55-34Z" fill="url(#home-fold-b)" />
          <path d="m315 226 91-37 28 100-121 32Z" fill="#d7efdd" />
          <path d="m406 189 69 18 34 99-75-17Z" fill="#b9e2c4" />
          <path d="m108 337 47-31 77-17 28 18 55 34 121-32 75 17 36-11-45-130-99-28-91 36-85-26-101 30Z" fill="none" stroke="#fff" strokeWidth="8" strokeLinejoin="round" />
          <path d="M153 302c39-34 70-20 100-1s60 5 89-21 52-49 82-44" fill="none" stroke="#087c48" strokeWidth="3" strokeDasharray="8 10" strokeLinecap="round" />
        </g>

        <g className="home-map-pin" transform="translate(281 222)" filter="url(#home-shadow)">
          <path d="M0 0c-25 0-44 19-44 43 0 33 44 83 44 83s44-50 44-83C44 19 25 0 0 0Z" fill="#078b4b" />
          <circle cy="42" r="14" fill="#fff" />
        </g>

        <g className="home-item-card" filter="url(#home-shadow)" transform="rotate(-3 478 132)">
          <rect x="385" y="76" width="190" height="116" rx="20" fill="#fff" />
          <path d="m408 111 25-14 25 14v30l-25 14-25-14Z" fill="#f4fbf6" stroke="#087c48" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="m408 111 25 14 25-14m-25 14v30" fill="none" stroke="#087c48" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="475" y="101" width="76" height="9" rx="4.5" fill="#b2e1c0" />
          <rect x="475" y="121" width="66" height="9" rx="4.5" fill="#c6e9d0" />
          <rect x="475" y="141" width="52" height="9" rx="4.5" fill="#c6e9d0" />
          <circle cx="555" cy="180" r="23" fill="#fff" />
          <circle cx="555" cy="180" r="16" fill="#078b4b" />
          <path d="m547 180 5 5 10-11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <path d="m218 195-13-19m25 8-7-22m-19 42-22 1m420-196-7 17m25-3-14 15m27 2-16 1" fill="none" stroke="#087c48" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
