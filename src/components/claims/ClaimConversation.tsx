"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import ClaimStatusBadge from "@/components/claims/ClaimStatusBadge";

type Message = { id: string; content: string; senderId: string; createdAt: string; sender: { name: string; username: string | null } };
type Conversation = { id: string; status: string; viewerRole: "CLAIMANT" | "FINDER" | "CUSTODIAN" | "ADMIN"; item: { title: string; location: string; custodyStatus: string | null; custodian: { name: string; username: string | null } | null; images: { url: string }[] }; other: { name: string; username: string | null; image: string | null } | null };
type OwnReport = { id: string; reason: string; description: string; createdAt: string };

export default function ClaimConversation({ claimId, viewerId }: { claimId: string; viewerId: string }) {
  const [claim, setClaim] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [code, setCode] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [ownReport, setOwnReport] = useState<OwnReport | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/claims/${claimId}/messages`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Unable to load this conversation.");
    setClaim(result.claim);
    setMessages(result.messages);
    if (result.claim.viewerRole === "CLAIMANT" && result.claim.status === "APPROVED") {
      const codeResponse = await fetch(`/api/claims/${claimId}/recovery-code`, { cache: "no-store" });
      if (codeResponse.ok) { const codeData = await codeResponse.json(); setRecoveryCode(codeData.code); }
      else setRecoveryCode("");
    } else setRecoveryCode("");
    const reportResponse = await fetch(`/api/claims/${claimId}/reports`, { cache: "no-store" });
    if (reportResponse.ok) { const reportData = await reportResponse.json(); setOwnReport(reportData.report ?? null); }
  }, [claimId]);
  useEffect(() => { const initial = window.setTimeout(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load this conversation.")); }, 0); const timer = window.setInterval(() => { void load().catch(() => undefined); }, 6000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || !text.trim()) return; setBusy(true); setError("");
    try { const response = await fetch(`/api/claims/${claimId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Message could not be sent."); setText(""); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Message could not be sent."); } finally { setBusy(false); }
  }
  async function claimAction(action: "approve" | "decline" | "withdraw") {
    const prompts = { approve: "Approve this claim? The claimant will receive a one-time recovery code, and the item will only be marked recovered after handover verification.", decline: "Decline this claim? The conversation history will remain available.", withdraw: "Are you sure you want to withdraw this claim? The finder will be notified, and the conversation will be closed." };
    if (!window.confirm(prompts[action])) return; setBusy(true); setError("");
    try { const response = await fetch(`/api/claims/${claimId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "This action could not be completed."); if (result.recoveryCode) setRecoveryCode(result.recoveryCode); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This action could not be completed."); } finally { setBusy(false); }
  }
  async function recover(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch(`/api/claims/${claimId}/recover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Recovery could not be confirmed."); setCode(""); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Recovery could not be confirmed."); } finally { setBusy(false); }
  }
  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const response = await fetch(`/api/claims/${claimId}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Report could not be sent."); setReportOpen(false); setError("Your report was sent to REVOK for review."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Report could not be sent."); } finally { setBusy(false); }
  }
  async function withdrawReport() {
    if (!window.confirm("Withdraw your report? It will be removed from the admin review queue.")) return;
    setBusy(true); setError("");
    try { const response = await fetch(`/api/claims/${claimId}/reports`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Report could not be withdrawn."); setOwnReport(null); setError(result.message ?? "Your report was withdrawn."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Report could not be withdrawn."); }
    finally { setBusy(false); }
  }
  if (!claim) return <main className="claim-conversation-page"><p>{error || "Loading conversation…"}</p></main>;
  const closed = ["CANCELLED", "REJECTED", "RECOVERED"].includes(claim.status);
  return <main className="claim-conversation-page">
    <header className="claim-conversation-header"><Link href="/dashboard/claims" className="button button-outline">← Claim requests</Link>{claim.item.images[0] && <Image className="claim-item-thumbnail" src={claim.item.images[0].url} width={88} height={88} unoptimized alt="" />}<div><p className="eyebrow">Claim {claim.id.slice(-8).toUpperCase()}</p><h1>{claim.item.title}</h1><p>{claim.other?.name}{claim.other?.username ? ` · @${claim.other.username}` : ""}</p><ClaimStatusBadge status={claim.status} custodyStatus={claim.item.custodyStatus} /><p>Current custody: {claim.item.custodyStatus === "WITH_STEWARD" ? `With REVOK Steward ${claim.item.custodian?.name ?? ""}${claim.item.custodian?.username ? ` · @${claim.item.custodian.username}` : ""}` : claim.item.custodyStatus === "HANDOVER_PENDING" ? "Handover requested" : claim.item.custodyStatus === "WITH_FINDER" ? "With the finder" : claim.item.custodyStatus ?? "Not specified"}</p></div></header>
    {recoveryCode && <section className="recovery-code-panel"><h2>Your one-time recovery code</h2><p>Share this with the finder only after you have physically received your item. Save it now; for security, it is shown only once.</p><strong>{recoveryCode}</strong><button className="button button-outline" onClick={() => void navigator.clipboard.writeText(recoveryCode)}>Copy code</button></section>}
    {claim.status === "APPROVED" && <p className="notice-card">Claim approved. The claimant should give the recovery code to the finder only after receiving the item.</p>}
    <section className="claim-chat" aria-label="Private claim conversation"><div className="claim-chat-messages">{messages.length ? messages.map((message) => <article className={`claim-chat-message ${message.senderId === viewerId ? "mine" : "theirs"}`} key={message.id}><p>{message.content}</p><small>{message.senderId === viewerId ? "You" : `${message.sender.name}${message.sender.username ? ` · @${message.sender.username}` : ""}`} · {new Date(message.createdAt).toLocaleString()}</small></article>) : <p>No messages yet.</p>}</div>{!closed && claim.viewerRole !== "ADMIN" && <form className="claim-chat-compose" onSubmit={send}><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={2} placeholder="Write a private message…" required /><button className="button button-primary" disabled={busy || !text.trim()}>Send</button></form>}</section>
    {!closed && claim.viewerRole !== "ADMIN" && <section className="claim-action-panel"><div className="button-row">{claim.status === "PENDING" && claim.viewerRole !== "CLAIMANT" && <><button className="button button-primary" disabled={busy} onClick={() => void claimAction("approve")}>Approve claim</button><button className="button button-outline" disabled={busy} onClick={() => void claimAction("decline")}>Decline claim</button></>}{claim.viewerRole === "CLAIMANT" && ["PENDING", "APPROVED"].includes(claim.status) && <button className="button button-outline" disabled={busy} onClick={() => void claimAction("withdraw")}>Withdraw claim</button>}{claim.status === "APPROVED" && claim.viewerRole !== "CLAIMANT" && <form className="recovery-verify-form" onSubmit={recover}><label>Confirm handover<input value={code} onChange={(event) => setCode(event.target.value)} minLength={16} maxLength={16} autoCapitalize="characters" placeholder="16-character code" required /></label><button className="button button-primary" disabled={busy}>Confirm Handover</button></form>}{!ownReport && <button className="button button-outline" onClick={() => setReportOpen((value) => !value)}>Report user</button>}</div></section>}
    {ownReport && <section className="claim-action-panel claim-own-report"><strong>You reported this conversation</strong><p><b>Reason:</b> {ownReport.reason}</p><p>{ownReport.description}</p><small>Sent {new Date(ownReport.createdAt).toLocaleString()}. It is visible to REVOK admins for review.</small><button className="button button-outline" type="button" disabled={busy} onClick={() => void withdrawReport()}>Withdraw report</button></section>}
    {reportOpen && <form className="claim-report-form" onSubmit={report}><label>Reason<select name="reason" required><option value="">Choose a reason</option>{["Misleading information", "Suspicious ownership claim", "Refused to return the item after approval", "Item handed over to another person without explanation", "Harassment or abusive messages", "Suspected scam", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label><label>What happened?<textarea name="description" minLength={20} maxLength={3000} required /></label><button className="button button-primary" disabled={busy}>Send report</button></form>}
    {error && <p className="auth-message" role="status">{error}</p>}
  </main>;
}
