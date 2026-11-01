"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; username: string | null; role: string; status: string };
export default function StewardManagement() {
  const [users, setUsers] = useState<User[]>([]); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(""); const [search, setSearch] = useState("");
  async function load() { const [regular, stewards] = await Promise.all([fetch("/api/admin/users?role=USER"), fetch("/api/admin/users?role=REVOK_STEWARD")]); const a = await regular.json(); const b = await stewards.json(); setUsers([...(a.users ?? []), ...(b.users ?? [])]); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function toggle(user: User) { if (!window.confirm(`${user.role === "REVOK_STEWARD" ? "Revoke Steward role from" : "Assign Steward role to"} ${user.name}?`)) return; setBusy(user.id); setMessage(""); try { const response = await fetch("/api/admin/stewards", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, assign: user.role !== "REVOK_STEWARD" }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); await load(); setMessage("Steward access updated."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update Steward access."); } finally { setBusy(""); } }
  const visible = users.filter((user) => `${user.name} ${user.username ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="admin-steward-section"><div className="admin-section-heading"><div><p className="eyebrow">Custody network</p><h2>Steward Management</h2><p>Assign REVOK Steward custody access to existing active user accounts.</p></div></div><label>Find a user<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or username" /></label><div className="admin-steward-list">{visible.map((user) => <article key={user.id}><div><strong>{user.name}</strong><span>{user.username ? `@${user.username}` : "No username"} · {user.status.toLowerCase()}</span></div><span className="status-chip">{user.role === "REVOK_STEWARD" ? "Steward" : "User"}</span><button className="button button-outline" disabled={busy === user.id || user.status !== "ACTIVE"} onClick={() => void toggle(user)}>{user.role === "REVOK_STEWARD" ? "Revoke Steward" : "Assign Steward"}</button></article>)}</div>{message && <p role="status">{message}</p>}</section>;
}
