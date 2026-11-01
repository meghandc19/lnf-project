"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

export default function ReportCommunicationActions({ type, id, title, signedIn, canSend, owner }: { type: "LOST" | "FOUND"; id: string; title: string; signedIn: boolean; canSend: boolean; owner: boolean }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  if (owner) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/reports/${type.toLowerCase()}/${encodeURIComponent(id)}/communications`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), clientRequestId: requestId.current }),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Your hint could not be sent."); return; }
      requestId.current = null;
      setBody("");
      setMessage("Sent privately to the report owner.");
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusy(false); }
  }

  if (!signedIn) return <section className="report-communication-actions"><p>Have useful information about this item?</p><Link className="button button-outline" href={`/login?callbackURL=${encodeURIComponent(`/items/${type.toLowerCase()}/${id}`)}`}>Log in to give a hint</Link></section>;
  if (!canSend) return <section className="report-communication-actions"><p>Messaging is unavailable while your account is restricted.</p></section>;

  return <section className="report-communication-actions" aria-label={`Private hints about ${title}`}>
    <div className="report-communication-buttons"><span>Have useful information?</span><button className="button button-outline" type="button" aria-expanded={open} onClick={() => { setOpen((value) => !value); setMessage(""); }}>Give a Hint</button></div>
    {open && <form className="report-message-form" onSubmit={submit}>
      <div><p className="eyebrow">Private hint</p><h2>Share useful information about {title}</h2></div>
      <p className="report-message-privacy">Your hint is visible only to the report owner and authorized moderators. It will not create a claim or appear publicly.</p>
      <label className="auth-field">Hint<textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={2000} rows={4} required placeholder="Share information that may help reunite this item with its owner." /></label>
      {message && <p className="auth-message" role="status">{message}{message.startsWith("Sent") && <Link href={`/dashboard/reports/${type.toLowerCase()}/${encodeURIComponent(id)}/communications`}> Open private hints</Link>}</p>}
      <div className="button-row"><button className="button button-primary" type="submit" disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send Hint"}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => { setOpen(false); setBody(""); setMessage(""); requestId.current = null; }}>Cancel</button></div>
    </form>}
  </section>;
}
