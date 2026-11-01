"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ClaimStatusBadge from "@/components/claims/ClaimStatusBadge";

export type ConversationEntry = {
  id: string; status: string; createdAt: string;
  item: { id: string; title: string; location: string; custodyStatus: string | null; image: string | null };
  other: { name: string; username: string | null; image: string | null };
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  lastReadAt: string | null;
  viewerId: string;
};

export default function ConversationList({ initialItems, emptyText }: { initialItems: ConversationEntry[]; emptyText: string }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function hideChat(id: string, title: string) {
    if (!window.confirm(`Delete this chat about “${title}” from your list? This only hides it for you. The claim, item report, and recovery history will remain.`)) return;
    setBusyId(id); setError("");
    try {
      const response = await fetch(`/api/claims/${encodeURIComponent(id)}/conversation`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not delete this chat.");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this chat."); }
    finally { setBusyId(""); }
  }

  if (!items.length) return <section className="empty-state conversation-empty"><h2>No conversations here yet.</h2><p>{emptyText}</p></section>;
  return <div className="conversation-list">
    {items.map((item) => {
      const unread = Boolean(item.lastMessage && item.lastMessage.senderId !== item.viewerId && (!item.lastReadAt || new Date(item.lastMessage.createdAt) > new Date(item.lastReadAt)));
      return <article className="conversation-list-card" key={item.id}>
        {item.item.image ? <Image className="conversation-item-image" src={item.item.image} width={68} height={68} alt="" unoptimized /> : <span className="conversation-item-image conversation-item-placeholder" aria-hidden="true">✳</span>}
        {item.other.image ? <Image className="conversation-person-image" src={item.other.image} width={36} height={36} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="conversation-person-image conversation-person-placeholder" aria-hidden="true">{item.other.name.slice(0, 1).toUpperCase()}</span>}
        <div className="conversation-list-copy">
          <h2>{item.item.title}</h2><span>With {item.other.name}{item.other.username ? ` · @${item.other.username}` : ""}</span>
          <ClaimStatusBadge status={item.status} custodyStatus={item.item.custodyStatus} />
          <p>{item.lastMessage?.content ?? "No messages yet."}</p>
          <small>{item.lastMessage ? new Date(item.lastMessage.createdAt).toLocaleString() : `Started ${new Date(item.createdAt).toLocaleDateString()}`}{unread ? " · Unread" : ""}</small>
        </div>
        <div className="conversation-list-actions"><Link href={`/claims/${encodeURIComponent(item.id)}`} className="button button-primary">Open conversation</Link><button className="button button-outline" type="button" disabled={busyId === item.id} onClick={() => void hideChat(item.id, item.item.title)}>{busyId === item.id ? "Deleting…" : "Delete chat"}</button></div>
      </article>;
    })}
    {error && <p className="auth-message" role="alert">{error}</p>}
  </div>;
}
