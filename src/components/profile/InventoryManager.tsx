"use client";

import { useState, type FormEvent } from "react";

export type InventoryEntry = { id: string; name: string; brand: string | null; color: string | null };

export default function InventoryManager({ initialItems, canEdit }: { initialItems: InventoryEntry[]; canEdit: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function resetForm() {
    setEditing(null); setName(""); setBrand(""); setColor(""); setMessage("");
  }

  function startEdit(item: InventoryEntry) {
    setEditing(item.id); setName(item.name); setBrand(item.brand ?? ""); setColor(item.color ?? ""); setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canEdit || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(editing ? `/api/account/inventory/${encodeURIComponent(editing)}` : "/api/account/inventory", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brand, color }),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Could not save this inventory item."); return; }
      if (editing) setItems((current) => current.map((item) => item.id === editing ? result.item : item));
      else setItems((current) => [...current, result.item]);
      resetForm();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusy(false); }
  }

  async function remove(item: InventoryEntry) {
    if (!canEdit || busy || !window.confirm(`Remove ${item.name} from your inventory?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/account/inventory/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Could not remove this item."); return; }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editing === item.id) resetForm();
    } catch { setMessage("Could not reach REVOK. Please try again."); }
    finally { setBusy(false); }
  }

  return <section className="profile-card inventory-card" aria-labelledby="inventory-title">
    <div className="inventory-heading"><div><p className="eyebrow">Private to your account</p><h2 id="inventory-title">My Inventory</h2></div><span className="inventory-count">{items.length} / 10 items</span></div>
    <p className="inventory-intro">Save items you own. If a matching found report is approved, we may let you know. Your inventory is never shown to other people.</p>
    {items.length ? <ul className="inventory-list">{items.map((item) => <li className="inventory-row" key={item.id}>
      <div><strong>{item.name}</strong><span>{[item.brand, item.color].filter(Boolean).join(" · ") || "No brand or color added"}</span></div>
      {canEdit && <div className="inventory-actions"><button className="button button-outline" type="button" onClick={() => startEdit(item)} disabled={busy}>Edit</button><button className="button button-outline inventory-delete" type="button" onClick={() => void remove(item)} disabled={busy}>Delete</button></div>}
    </li>)}</ul> : <p className="inventory-empty">No items saved yet.</p>}
    {canEdit && items.length < 10 && editing === null && <button className="button button-outline inventory-add" type="button" onClick={() => { setEditing(""); setMessage(""); }}>Add item</button>}
    {canEdit && items.length >= 10 && editing === null && <p className="inventory-limit">Your inventory is full. Delete an item to make room.</p>}
    {canEdit && editing !== null && <form className="inventory-form" onSubmit={save}>
      <h3>{editing ? "Edit inventory item" : "Add inventory item"}</h3>
      <label className="auth-field">Item name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></label>
      <div className="report-field-grid"><label className="auth-field">Brand <small>(optional)</small><input value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={100} /></label><label className="auth-field">Color <small>(optional)</small><input value={color} onChange={(event) => setColor(event.target.value)} maxLength={80} /></label></div>
      {message && <p className="auth-message" role="alert">{message}</p>}
      <div className="button-row"><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add to inventory"}</button><button className="button button-outline" type="button" onClick={resetForm} disabled={busy}>Cancel</button></div>
    </form>}
    {!editing && message && <p className="auth-message" role="alert">{message}</p>}
  </section>;
}
