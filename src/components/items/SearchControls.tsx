"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ITEM_CATEGORIES } from "@/lib/items/categories";

type Values = { q: string; type: "FOUND" | "LOST"; category: string; sort: "newest" | "oldest" | "relevance"; location: string; from: string; to: string };

export default function SearchControls({ values, count }: { values: Values; count: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(values.q);
  const [location, setLocation] = useState(values.location);
  const [syncedQuery, setSyncedQuery] = useState(values.q);
  const [syncedLocation, setSyncedLocation] = useState(values.location);
  const [queryFocused, setQueryFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!queryFocused && values.q !== syncedQuery) { setSyncedQuery(values.q); setQuery(values.q); }
  if (!locationFocused && values.location !== syncedLocation) { setSyncedLocation(values.location); setLocation(values.location); }

  function navigate(next: Partial<Values>) {
    if (timer.current) clearTimeout(timer.current);
    const merged = { ...values, q: query, location, ...next };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (!value || (key === "sort" && value === "newest")) continue;
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function changeQuery(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate({ q: value.trim() }), 400);
  }

  return <div className="search-controls">
    <div className="search-primary-row">
      <label className="search-query-field"><span className="visually-hidden">Search item name, brand, category, or description</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input type="search" value={query} maxLength={100} placeholder="Search items…" onFocus={() => setQueryFocused(true)} onBlur={() => setQueryFocused(false)} onChange={(event) => changeQuery(event.target.value)} /></label>
      <div className="search-type-switch" role="group" aria-label="Choose report type">
        <button type="button" aria-pressed={values.type === "FOUND"} onClick={() => navigate({ type: "FOUND" })}>Found</button>
        <button type="button" aria-pressed={values.type === "LOST"} onClick={() => navigate({ type: "LOST" })}>Lost</button>
      </div>
    </div>
    <div className="search-filter-row">
      <label>Category<select value={values.category} onChange={(event) => navigate({ category: event.target.value })}><option value="">All categories</option>{ITEM_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label>Sort<select value={values.sort} onChange={(event) => navigate({ sort: event.target.value as Values["sort"] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="relevance" disabled={!query.trim()}>Most relevant</option></select></label>
      <details className="search-more-filters"><summary>More filters</summary><div className="search-more-panel">
        <label>Location or area<input value={location} maxLength={100} placeholder="e.g. college library" onFocus={() => setLocationFocused(true)} onBlur={() => setLocationFocused(false)} onChange={(event) => { const value = event.target.value; setLocation(value); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => navigate({ location: value.trim() }), 400); }} /></label>
        <label>From date<input type="date" value={values.from} onChange={(event) => navigate({ from: event.target.value })} /></label>
        <label>To date<input type="date" value={values.to} onChange={(event) => navigate({ to: event.target.value })} /></label>
      </div></details>
      <p className="search-result-count" aria-live="polite">{count} {count === 1 ? "item" : "items"}</p>
      <button className="search-reset" type="button" onClick={() => { setQuery(""); navigate({ q: "", type: "FOUND", category: "", sort: "newest", location: "", from: "", to: "" }); }}>Reset</button>
    </div>
  </div>;
}
