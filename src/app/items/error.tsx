"use client";

export default function ItemsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="subpage-main page-width"><section className="empty-state" role="alert"><p className="eyebrow">Search unavailable</p><h1>We could not load the item reports.</h1><p>Your account and reports are unchanged. Try loading this page again in a moment.</p><button className="button button-primary" onClick={() => reset()}>Try again</button></section></main>;
}
