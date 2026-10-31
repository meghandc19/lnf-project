"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ItemReviewControls({ id, type }: { id: string; type: "LOST" | "FOUND" }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function review(status: "APPROVED" | "FLAGGED" | "BLOCKED") {
    const labels = { APPROVED: "approve", FLAGGED: "flag", BLOCKED: "block" };
    const descriptions = {
      APPROVED: "This report and its photos can appear in public search.",
      FLAGGED: "This report will stay out of public search and remain in the review queue.",
      BLOCKED: "This report will be blocked from public search.",
    };
    if (!window.confirm(`Are you sure you want to ${labels[status]} this report? ${descriptions[status]}`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/items/${encodeURIComponent(id)}?type=${type}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Review could not be saved."); return; }
      router.refresh();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="admin-review-controls"><label>Internal review note <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Optional note; this is not public" rows={2} /></label><div className="button-row"><button type="button" className="button button-primary" disabled={busy} onClick={() => void review("APPROVED")}>Approve</button><button type="button" className="button button-outline" disabled={busy} onClick={() => void review("FLAGGED")}>Flag</button><button type="button" className="button button-danger" disabled={busy} onClick={() => void review("BLOCKED")}>Block</button></div>{message && <p role="status" aria-live="polite">{message}</p>}</div>;
}
