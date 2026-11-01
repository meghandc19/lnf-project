"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function UserReportDecision({ id, value }: { id: string; value: string | null }) {
  const router = useRouter();
  const [decision, setDecision] = useState(value ?? ""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); setMessage(""); try { const response = await fetch(`/api/admin/user-reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage("Decision recorded."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the decision."); } finally { setBusy(false); } }
  return <div className="admin-report-decision"><label>Administrative review decision<textarea value={decision} onChange={(event) => setDecision(event.target.value)} minLength={3} maxLength={1000} rows={2} /></label><button className="button button-outline" disabled={busy || decision.trim().length < 3} onClick={() => void save()}>Record review</button>{message && <small role="status">{message}</small>}</div>;
}
