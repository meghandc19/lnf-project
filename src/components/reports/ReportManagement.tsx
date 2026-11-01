"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ITEM_CATEGORIES, LOST_ITEM_CATEGORIES } from "@/lib/items/categories";

type ReportFields = {
  title: string;
  description: string;
  location: string;
  category: string;
  occurredAt: string;
  subcategory: string | null;
  brand: string | null;
  color: string | null;
  privateDetails: string | null;
  approximateTime: string | null;
  locationDetails: string | null;
};

function localDateTimeValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function ReportEditForm({ id, type, report }: { id: string; type: "LOST" | "FOUND"; report: ReportFields }) {
  const router = useRouter();
  const [category, setCategory] = useState(report.category);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const categories = type === "LOST" ? LOST_ITEM_CATEGORIES : ITEM_CATEGORIES;
  const isOtherLostItem = type === "LOST" && category === "Other";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const data: Record<string, FormDataEntryValue | null> = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (data.occurredAt) data.occurredAt = new Date(String(data.occurredAt)).toISOString();
    if (type === "LOST") {
      data.approximateTime = data.occurredAtApproximate ? "Approximate" : null;
      data.subcategory = data.category === "Other" ? data.subcategory || null : null;
      delete data.occurredAtApproximate;
    }
    for (const key of ["subcategory", "brand", "color", "privateDetails", "locationDetails"]) if (!data[key]) data[key] = null;
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(id)}?type=${type}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Could not save those changes."); return; }
      router.push("/dashboard"); router.refresh();
    } catch { setMessage("We could not reach REVOK. Please try again."); }
    finally { setSaving(false); }
  }

  return <form className={`report-form report-form-edit report-form-${type.toLowerCase()}`} onSubmit={submit}>
    <label className="auth-field">{type === "LOST" ? "Item name" : "What did you find?"}<input name="title" defaultValue={report.title} minLength={3} maxLength={100} required /></label>
    <label className="auth-field">Category<select name="category" value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}{!categories.some((itemCategory) => itemCategory === report.category) && <option value={report.category}>{report.category}</option>}</select></label>
    {isOtherLostItem && <label className="auth-field">What kind of item is it? <small>(optional)</small><input name="subcategory" defaultValue={report.subcategory ?? ""} maxLength={80} placeholder="e.g. Umbrella, water bottle, lunch box" /></label>}
    {type === "FOUND" && <p className="report-field-help">The item photo already attached to this report cannot be changed here.</p>}
    {type === "LOST" && <label className="auth-field">Brand <small>(optional)</small><input name="brand" defaultValue={report.brand ?? ""} maxLength={100} placeholder="Brand or maker" /></label>}
    {type === "LOST" && <label className="auth-field">Color<input name="color" defaultValue={report.color ?? ""} maxLength={80} placeholder="Main color" required /></label>}
    <label className="auth-field">{type === "LOST" ? "Description" : "Describe the item"}<textarea name="description" defaultValue={report.description} required minLength={10} maxLength={2000} rows={type === "LOST" ? 4 : 3} placeholder={type === "LOST" ? "Describe visible features, color patterns, or damage." : "Add details that may help identify the item."} /></label>
    <label className="auth-field">{type === "LOST" ? "Last seen at" : "Where did you find it?"}<input name="location" defaultValue={report.location} required minLength={3} maxLength={180} placeholder="A public place or general landmark" /></label>
    {type === "FOUND" && <label className="auth-field">More location details <small>(optional)</small><textarea name="locationDetails" defaultValue={report.locationDetails ?? ""} maxLength={300} rows={2} placeholder="Near an entrance or another public landmark" /></label>}
    <label className="auth-field">{type === "LOST" ? "Date and time lost" : "When did you find it?"}<input name="occurredAt" type="datetime-local" max={localDateTimeValue(new Date().toISOString())} defaultValue={localDateTimeValue(report.occurredAt)} required />{type === "LOST" && <span className="report-checkbox-row"><input name="occurredAtApproximate" type="checkbox" value="true" defaultChecked={report.approximateTime === "Approximate"} /> <span>This date and time is approximate</span></span>}</label>
    <label className="auth-field">{type === "LOST" ? "Private ownership detail" : "Private identifying detail"} <small>(optional)</small><textarea name="privateDetails" defaultValue={report.privateDetails ?? ""} maxLength={1000} rows={2} placeholder={type === "LOST" ? "A detail only the owner is likely to know." : "A detail that can help confirm ownership."} /></label>
    {message && <p role="status" className="auth-message">{message}</p>}
    <button className="auth-submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
    <p className="report-privacy-note">Edited reports return to pending review. Photos attached to a report cannot be changed from this editor yet.</p>
  </form>;
}

export function ReportActions({ id, type, status, locked = false }: { id: string; type: "LOST" | "FOUND"; status: string; locked?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(id)}?type=${type}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json(); if (!response.ok) { setMessage(result.message ?? "That action could not be completed."); return; }
      router.refresh();
    } catch { setMessage("We could not reach REVOK. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="report-actions"><a aria-disabled={locked} className={`button button-outline ${locked ? "is-disabled" : ""}`} href={locked ? undefined : `/dashboard/reports/${type.toLowerCase()}/${id}/edit`}>Edit</a><button className="button button-outline" disabled={busy || locked} onClick={() => void request("PATCH", { status: status === "CLOSED" ? "ACTIVE" : "CLOSED" })}>{status === "CLOSED" ? "Reopen" : "Mark resolved"}</button><button className="button button-danger" disabled={busy || locked} onClick={() => { if (window.confirm("Remove this report from your active history? It will be retained for moderation records.")) void request("DELETE"); }}>Delete</button>{message && <small role="status">{message}</small>}</div>;
}
