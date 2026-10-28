"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ITEM_CATEGORIES } from "@/lib/items/categories";

type ReportFields = { title: string; description: string; location: string; category: string; occurredAt: string; subcategory: string | null; brand: string | null; model: string | null; color: string | null; material: string | null; identifyingMarks: string | null; privateDetails: string | null; approximateTime: string | null; locationDetails: string | null; contactedAbout?: string | null; custodyStatus?: string | null };

function localDateTimeValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function ReportEditForm({ id, type, report }: { id: string; type: "LOST" | "FOUND"; report: ReportFields }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const data: Record<string, FormDataEntryValue | null> = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (data.occurredAt) data.occurredAt = new Date(String(data.occurredAt)).toISOString();
    for (const key of ["subcategory", "brand", "model", "color", "material", "identifyingMarks", "privateDetails", "approximateTime", "locationDetails", "contactedAbout", "custodyStatus"]) if (!data[key]) data[key] = null;
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(id)}?type=${type}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "Could not save those changes."); return; }
      router.push("/dashboard"); router.refresh();
    } catch { setMessage("We could not reach REVOK. Please try again."); }
    finally { setSaving(false); }
  }
  return <form className="report-form" onSubmit={submit}>
    {([ ["title", "Title", report.title], ["category", "Category", report.category], ["occurredAt", type === "LOST" ? "Date lost" : "Date found", report.occurredAt], ["description", "Description", report.description], ["location", "Location", report.location], ["subcategory", "Subcategory", report.subcategory], ["brand", "Brand", report.brand], ["model", "Model", report.model], ["color", "Color", report.color], ["material", "Material or appearance", report.material], ["identifyingMarks", "Distinguishing marks", report.identifyingMarks], ["approximateTime", "Approximate time", report.approximateTime], ["locationDetails", "Location detail", report.locationDetails], ["privateDetails", "Private identifying information", report.privateDetails], ...(type === "LOST" ? [["contactedAbout", "Already contacted", report.contactedAbout]] : [["custodyStatus", "Custody status", report.custodyStatus]]) ] as [string, string, string | null | undefined][]).map(([name, label, value]) => <label className="auth-field" key={name}>{label}{name === "category" ? <select name={name} defaultValue={value ?? ""} required>{ITEM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select> : name === "occurredAt" ? <input name={name} type="datetime-local" defaultValue={localDateTimeValue(value ?? new Date().toISOString())} required /> : name === "custodyStatus" ? <select name={name} defaultValue={value ?? "UNKNOWN"}><option value="UNKNOWN">Not specified</option><option value="WITH_FINDER">With me</option><option value="SECURITY_OFFICE">Security office</option><option value="HANDED_OVER">Handed over</option></select> : name === "description" || name === "identifyingMarks" || name === "privateDetails" || name === "locationDetails" ? <textarea name={name} defaultValue={value ?? ""} maxLength={name === "description" ? 2000 : name === "privateDetails" ? 1000 : 500} rows={name === "description" ? 5 : 3} required={name === "description"} /> : <input name={name} defaultValue={value ?? ""} maxLength={name === "title" ? 100 : 300} required={["title", "location"].includes(name)} />}</label>)}
    {message && <p role="status" className="auth-message">{message}</p>}<button className="auth-submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
    <p className="report-privacy-note">Edited reports return to pending review. Photos attached to a report cannot be changed from this editor yet.</p>
  </form>;
}

export function ReportActions({ id, type, status }: { id: string; type: "LOST" | "FOUND"; status: string }) {
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
  return <div className="report-actions"><a className="button button-outline" href={`/dashboard/reports/${type.toLowerCase()}/${id}/edit`}>Edit</a><button className="button button-outline" disabled={busy} onClick={() => void request("PATCH", { status: status === "CLOSED" ? "ACTIVE" : "CLOSED" })}>{status === "CLOSED" ? "Reopen" : "Mark resolved"}</button><button className="button button-danger" disabled={busy} onClick={() => { if (window.confirm("Remove this report from your active history? It will be retained for moderation records.")) void request("DELETE"); }}>Delete</button>{message && <small role="status">{message}</small>}</div>;
}
