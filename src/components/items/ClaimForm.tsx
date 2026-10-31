"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Access = "guest" | "restricted" | "unverified" | "eligible" | "owner";

export default function ClaimForm({ foundItemId, itemTitle, access, existingStatus }: { foundItemId: string; itemTitle: string; access: Access; existingStatus?: string | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(Boolean(existingStatus));
  const callbackURL = `/items/found/${encodeURIComponent(foundItemId)}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ foundItemId, message }) });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "The claim request could not be sent. Please try again.");
        return;
      }
      setSent(true);
      setOpen(false);
      setMessage("");
    } catch {
      setError("We could not reach REVOK. Your message is still here; please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (access === "owner") return null;
  if (existingStatus || sent) return <p className="claim-status-message" role="status">You have already sent a claim request for this item{existingStatus ? ` (${existingStatus.toLowerCase()})` : ""}.</p>;
  if (access === "guest") return <div className="claim-callout"><Link className="button button-primary" href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`}>Log in to claim this item</Link></div>;
  if (access === "restricted") return <p className="claim-status-message">Your account cannot send claim requests right now.</p>;
  if (access === "unverified") return <div className="claim-callout"><p>Verify your phone to send a claim request.</p><Link className="button button-primary" href={`/register/complete?callbackURL=${encodeURIComponent(callbackURL)}`}>Verify phone</Link></div>;

  return <div className="claim-panel">
    {!open ? <button className="button button-primary" type="button" onClick={() => { setOpen(true); setError(""); }}>Claim this item</button> : <form className="claim-form" onSubmit={submit}>
      <label htmlFor="claim-message">Why do you believe this item belongs to you?</label>
      <textarea id="claim-message" value={message} minLength={10} maxLength={1500} required rows={4} onChange={(event) => setMessage(event.target.value)} placeholder={`Share identifying details about ${itemTitle}. Do not include passwords, OTPs, PINs, or bank details.`} />
      <p className="claim-safety-note">Stay safe while communicating. Do not share your phone number, passwords, OTPs, PINs, bank details, or other personal information. Keep communication within REVOK. Sharing personal contact details is at your own risk.</p>
      {error && <p className="auth-message" role="alert">{error}</p>}
      <div className="button-row"><button className="button button-primary" type="submit" disabled={busy || message.trim().length < 10}>{busy ? "Sending request…" : "Send Claim Request"}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div>
    </form>}
    {error && !open && <p className="auth-message" role="alert">{error}</p>}
  </div>;
}
