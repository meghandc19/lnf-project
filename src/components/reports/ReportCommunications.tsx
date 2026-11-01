"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Message = { id: string; kind: "COMMENT" | "HINT"; body: string; location: string | null; sightingAt: string | null; createdAt: string; parentMessageId: string | null; senderId: string; sender: { id: string; name: string; username: string | null; image: string | null } };
type Result = { report: { id: string; type: "LOST" | "FOUND"; title: string }; isOwner: boolean; isModerator: boolean; canReply: boolean; messages: Message[] };

export default function ReportCommunications({ type, id, threadId }: { type: "lost" | "found"; id: string; threadId?: string }) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [bodyByThread, setBodyByThread] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const endpoint = `/api/reports/${type}/${encodeURIComponent(id)}/communications`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${endpoint}${threadId ? `?thread=${encodeURIComponent(threadId)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "Private messages could not be loaded."); return; }
      setResult(data); setError("");
    } catch { setError("Could not reach REVOK. Please try again."); }
  }, [endpoint, threadId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function reply(event: FormEvent<HTMLFormElement>, rootId: string) {
    event.preventDefault();
    const body = (bodyByThread[rootId] ?? "").trim();
    if (!body || busy) return;
    setBusy(rootId); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, parentMessageId: rootId, clientRequestId: crypto.randomUUID() }) });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "Your reply could not be sent."); return; }
      setBodyByThread((current) => ({ ...current, [rootId]: "" }));
      await load(); router.refresh();
    } catch { setError("Could not reach REVOK. Please try again."); }
    finally { setBusy(""); }
  }

  if (!result) return <section className="private-communications"><p role="status">{error || "Loading private messages…"}</p></section>;
  const roots = result.messages.filter((message) => !message.parentMessageId);
  return <section className="private-communications" aria-label="Private report messages">
    {error && <p className="auth-message" role="status">{error}</p>}
    {roots.length ? roots.map((root) => {
      const thread = result.messages.filter((message) => message.id === root.id || message.parentMessageId === root.id);
      return <article className="private-message-thread" key={root.id}>
        {thread.map((message) => <div className={`private-message${message.senderId === root.senderId ? "" : " private-message-reply"}`} key={message.id}>
          <div className="private-message-author">{message.sender.image ? <Image src={message.sender.image} alt="" width={36} height={36} unoptimized referrerPolicy="no-referrer" /> : <span aria-hidden="true">{message.sender.name.slice(0, 1).toUpperCase()}</span>}<div><strong>{message.sender.name}</strong><small>{message.sender.username ? `@${message.sender.username}` : "REVOK member"}</small></div></div>
          <p>{message.body}</p>
          {message.location && <small>Location: {message.location}</small>}{message.sightingAt && <small>Seen: {new Date(message.sightingAt).toLocaleString()}</small>}
          <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
        </div>)}
        {result.canReply && <form className="private-message-reply-form" onSubmit={(event) => void reply(event, root.id)}><label className="auth-field">Private reply<textarea rows={2} maxLength={2000} value={bodyByThread[root.id] ?? ""} onChange={(event) => setBodyByThread((current) => ({ ...current, [root.id]: event.target.value }))} placeholder="Reply to this private message" required /></label><button className="button button-primary" type="submit" disabled={busy === root.id || !(bodyByThread[root.id] ?? "").trim()}>{busy === root.id ? "Sending…" : "Send reply"}</button></form>}
      </article>;
    }) : <div className="empty-state"><h2>No private hints yet</h2><p>No private hints have been received for this report yet.</p></div>}
  </section>;
}
