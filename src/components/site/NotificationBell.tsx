"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Notice = { id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string; foundItemId: string | null; lostItemId: string | null; claimId: string | null; friendshipId: string | null; reportMessageId: string | null; foundItem: { title: string } | null; reportMessage: { id: string; kind: string; lostItemId: string | null; foundItemId: string | null; parentMessageId: string | null } | null };

function destination(notice: Notice) {
  if (notice.type === "MATCH" && notice.foundItemId) return `/items/found/${encodeURIComponent(notice.foundItemId)}`;
  if (notice.type === "FRIEND_REPORT") {
    const type = notice.lostItemId ? "lost" : "found";
    const id = notice.lostItemId ?? notice.foundItemId;
    if (id) return `/items/${type}/${encodeURIComponent(id)}`;
  }
  if (notice.type === "FRIEND_REQUEST" || notice.type === "FRIEND_ACCEPTED") return "/profile?section=friends";
  if ((notice.type === "REPORT_COMMENT" || notice.type === "REPORT_HINT") && notice.reportMessage) {
    const message = notice.reportMessage;
    const type = message.lostItemId ? "lost" : "found";
    const id = message.lostItemId ?? message.foundItemId;
    if (id) return `/dashboard/reports/${type}/${encodeURIComponent(id)}/communications?thread=${encodeURIComponent(message.parentMessageId ?? message.id)}`;
  }
  if (notice.claimId) return `/claims/${encodeURIComponent(notice.claimId)}`;
  if (notice.type === "CLAIM" || notice.type === "MESSAGE") return "/dashboard/claims";
  return "/dashboard";
}

export default function NotificationBell() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      setItems(result.notifications ?? []); setUnreadCount(result.unreadCount ?? 0); setError("");
    } catch { setError("Notifications could not be loaded."); }
  }, []);

  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const interval = window.setInterval(() => void load(), 30000); return () => { window.clearTimeout(initial); window.clearInterval(interval); }; }, [load]);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function openNotice(notice: Notice) {
    setOpen(false);
    if (!notice.readAt) {
      try {
        const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notice.id }) });
        if (response.ok) { setItems((current) => current.map((entry) => entry.id === notice.id ? { ...entry, readAt: new Date().toISOString() } : entry)); setUnreadCount((count) => Math.max(0, count - 1)); }
      } catch { /* Still open the destination if read state cannot be updated. */ }
    }
    router.push(destination(notice));
  }

  async function deleteNotice(notice: Notice) {
    if (!notice.readAt || deletingId) return;
    setDeletingId(notice.id); setError("");
    try {
      const response = await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notice.id }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "This notification could not be deleted."); return; }
      setItems((current) => current.filter((entry) => entry.id !== notice.id));
    } catch { setError("Could not reach REVOK. Please try again."); }
    finally { setDeletingId(""); }
  }

  return <div className="notification-menu" ref={root}>
    <button className="notification-toggle" type="button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className="notification-popover" role="dialog" aria-label="Recent notifications">
      <div className="notification-popover-heading"><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span></div>
      {error && <p className="notification-empty" role="status">{error}</p>}{items.length ? <ul className="notification-list">{items.map((notice) => <li className={`notification-entry-row${notice.type === "FRIEND_REPORT" ? " notification-entry-priority" : ""}${notice.readAt ? "" : " is-unread"}`} key={notice.id}>
        <button type="button" className={`notification-entry${notice.readAt ? "" : " is-unread"}`} onClick={() => void openNotice(notice)}>
          <span className="notification-entry-mark" aria-hidden="true">{notice.type === "MATCH" ? "✳" : notice.type === "MESSAGE" ? "↗" : "•"}</span>
          <span className="notification-entry-copy"><strong>{notice.title}</strong><span>{notice.message}</span><small>{new Date(notice.createdAt).toLocaleString()}</small></span>
        </button>
        {!notice.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
        {notice.readAt && <button type="button" className="notification-delete" aria-label={`Delete viewed notification: ${notice.title}`} title="Delete viewed notification" disabled={Boolean(deletingId)} onClick={() => void deleteNotice(notice)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v6m4-6v6" /></svg></button>}
      </li>)}</ul> : <p className="notification-empty">You don’t have any notifications yet.</p>}
      <Link className="notification-all-link" href="/dashboard/claims" onClick={() => setOpen(false)}>Open claim conversations</Link>
    </section>}
  </div>;
}
