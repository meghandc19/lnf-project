"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Steward = { id: string; name: string; username: string | null };
type HandoverRequest = {
  id: string;
  status: string;
  foundItem: { title: string; location: string; category: { name: string }; images: { url: string }[] };
  finder: { name: string; username: string | null };
};
type CustodyClaim = {
  id: string;
  status: string;
  user: { name: string; username: string | null };
  foundItem: { title: string };
};

async function readResponse(response: Response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof result.message === "string" ? result.message : "Could not load handover information.",
    );
  }
  return result;
}

export function HandoverButton({ foundItemId }: { foundItemId: string }) {
  const [stewards, setStewards] = useState<Steward[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/handovers", { cache: "no-store" })
      .then(readResponse)
      .then((result) => {
        if (active) setStewards(result.stewards ?? []);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load available Stewards.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (busy || !selected) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundItemId, stewardId: selected }),
      });
      const result = await readResponse(response);
      setMessage(result.message ?? "Handover request sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the handover request.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <small role="status">Loading available REVOK Stewards...</small>;
  if (!stewards.length) {
    return <small role={message ? "alert" : "status"}>{message || "No REVOK Stewards are currently available."}</small>;
  }

  return (
    <div className="handover-controls">
      <label>
        Transfer custody
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose a REVOK Steward</option>
          {stewards.map((steward) => (
            <option key={steward.id} value={steward.id}>
              {steward.name}{steward.username ? ` · @${steward.username}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-outline" disabled={busy || !selected} onClick={() => void submit()}>
        {busy ? "Sending..." : "Request steward handover"}
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}

export default function StewardDashboard() {
  const [requests, setRequests] = useState<HandoverRequest[]>([]);
  const [claims, setClaims] = useState<CustodyClaim[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      const result = await readResponse(await fetch("/api/handovers", { cache: "no-store" }));
      setRequests(result.requests ?? []);
      setClaims(result.claims ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load handover information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(id: string, action: "accept" | "decline") {
    if (busyId) return;
    if (!window.confirm(`${action === "accept" ? "Accept" : "Decline"} this item handover?`)) return;
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch("/api/handovers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = await readResponse(response);
      setMessage(result.message ?? "Handover updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the handover.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="dashboard-claims">
      <h2>Items Awaiting Handover</h2>
      {message && <p role="status">{message}</p>}
      {loading ? <p role="status">Loading handover requests...</p> : requests.length ? requests.map((request) => (
        <article className="dashboard-claim-card" key={request.id}>
          <strong>{request.foundItem.title}</strong>
          <span>{request.foundItem.category.name} · {request.foundItem.location}</span>
          <span>Requested by {request.finder.name}{request.finder.username ? ` · @${request.finder.username}` : ""}</span>
          <small>{request.status.toLowerCase()}</small>
          {request.status === "PENDING" && <div className="button-row">
            <button className="button button-primary" disabled={Boolean(busyId)} onClick={() => void decide(request.id, "accept")}>
              {busyId === request.id ? "Updating..." : "Accept handover"}
            </button>
            <button className="button button-outline" disabled={Boolean(busyId)} onClick={() => void decide(request.id, "decline")}>
              Decline handover
            </button>
          </div>}
        </article>
      )) : !message && <p>No steward handover requests yet.</p>}
      <h3>Claims for items in your custody</h3>
      {loading ? null : claims.length ? claims.map((claim) => (
        <article className="dashboard-claim-card" key={claim.id}>
          <strong>{claim.foundItem.title}</strong>
          <span>Claim from {claim.user.name}{claim.user.username ? ` · @${claim.user.username}` : ""} · {claim.status.toLowerCase()}</span>
          <Link className="button button-outline" href={`/claims/${encodeURIComponent(claim.id)}`}>Open private conversation</Link>
        </article>
      )) : !message && <p>No active claims for items in your custody.</p>}
    </section>
  );
}
