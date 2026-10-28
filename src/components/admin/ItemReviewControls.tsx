"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ItemReviewControls({ id, type }: { id: string; type: "LOST" | "FOUND" }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function review(status: "APPROVED" | "FLAGGED" | "BLOCKED") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/items/${encodeURIComponent(id)}?type=${type}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Review could not be saved."); return; }
      router.refresh();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="admin-review-controls"><label>Internal review note <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Optional note; this is not public" rows={2} /></label><div className="button-row"><button className="button button-primary" disabled={busy} onClick={() => void review("APPROVED")}>Approve</button><button className="button button-outline" disabled={busy} onClick={() => void review("FLAGGED")}>Flag</button><button className="button button-danger" disabled={busy} onClick={() => void review("BLOCKED")}>Block</button></div>{message && <p role="status">{message}</p>}</div>;
}
