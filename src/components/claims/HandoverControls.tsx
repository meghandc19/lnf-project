"use client";

import { useEffect, useState } from "react";

type Steward = { id: string; name: string; username: string | null };
export function HandoverButton({ foundItemId }: { foundItemId: string }) {
  const [stewards, setStewards] = useState<Steward[]>([]); const [selected, setSelected] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/handovers").then(async (r) => { const d = await r.json(); if (r.ok) setStewards(d.stewards ?? []); }); }, []);
  async function submit() { setBusy(true); setMessage(""); try { const response = await fetch("/api/handovers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ foundItemId, stewardId: selected }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage("Handover request sent."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not send the handover request."); } finally { setBusy(false); } }
  if (!stewards.length) return <small>No REVOK Stewards are currently available.</small>;
  return <div className="handover-controls"><label>Transfer custody<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose a REVOK Steward</option>{stewards.map((steward) => <option key={steward.id} value={steward.id}>{steward.name}{steward.username ? ` · @${steward.username}` : ""}</option>)}</select></label><button className="button button-outline" disabled={busy || !selected} onClick={() => void submit()}>{busy ? "Sending…" : "Request steward handover"}</button>{message && <small role="status">{message}</small>}</div>;
}

export default function StewardDashboard() {
  const [requests, setRequests] = useState<Array<{ id: string; status: string; foundItem: { title: string; location: string; category: { name: string }; images: { url: string }[] }; finder: { name: string; username: string | null } }>>([]);
  const [claims, setClaims] = useState<Array<{ id: string; status: string; user: { name: string; username: string | null }; foundItem: { title: string } }>>([]);
  const [message, setMessage] = useState("");
  async function load() { const r = await fetch("/api/handovers", { cache: "no-store" }); const d = await r.json(); if (r.ok) { setRequests(d.requests ?? []); setClaims(d.claims ?? []); } }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function decide(id: string, action: "accept" | "decline") { if (!window.confirm(`${action === "accept" ? "Accept" : "Decline"} this item handover?`)) return; const r = await fetch("/api/handovers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) }); const d = await r.json(); setMessage(r.ok ? "Handover updated." : d.message ?? "Could not update handover."); if (r.ok) await load(); }
  return <section className="dashboard-claims"><h2>Items Awaiting Handover</h2>{requests.length ? requests.map((request) => <article className="dashboard-claim-card" key={request.id}><strong>{request.foundItem.title}</strong><span>{request.foundItem.category.name} · {request.foundItem.location}</span><span>Requested by {request.finder.name}{request.finder.username ? ` · @${request.finder.username}` : ""}</span><small>{request.status.toLowerCase()}</small>{request.status === "PENDING" && <div className="button-row"><button className="button button-primary" onClick={() => void decide(request.id, "accept")}>Accept handover</button><button className="button button-outline" onClick={() => void decide(request.id, "decline")}>Decline handover</button></div>}</article>) : <p>No steward handover requests yet.</p>}<h3>Claims for items in your custody</h3>{claims.length ? claims.map((claim) => <article className="dashboard-claim-card" key={claim.id}><strong>{claim.foundItem.title}</strong><span>Claim from {claim.user.name}{claim.user.username ? ` · @${claim.user.username}` : ""} · {claim.status.toLowerCase()}</span><a className="button button-outline" href={`/claims/${claim.id}`}>Open private conversation</a></article>) : <p>No active claims for items in your custody.</p>}{message && <p role="status">{message}</p>}</section>;
}
