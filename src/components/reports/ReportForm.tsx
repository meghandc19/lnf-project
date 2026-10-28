"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ITEM_CATEGORIES } from "@/lib/items/categories";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function ReportForm({ type }: { type: "LOST" | "FOUND" }) {
  const router = useRouter();
  const isLost = type === "LOST";
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const previewUrls = useRef(new Set<string>());
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function addFiles(selected: FileList | File[]) {
    const next = Array.from(selected);
    if (next.some((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0)) {
      setMessage("Use JPEG, PNG, or WebP images that are 5 MB or smaller.");
      return;
    }
    if (photos.length + next.length > MAX_IMAGES) {
      setMessage("Choose no more than 3 photos.");
      return;
    }
    setMessage("");
    setPhotos((current) => [...current, ...next.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { file, preview };
    })]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    form.set("type", type);
    form.set("occurredAt", new Date(String(form.get("occurredAt"))).toISOString());
    for (const { file } of photos) form.append("images", file);
    try {
      const response = await fetch("/api/items", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "We couldn’t save the report. Please check the details and try again.");
        return;
      }
      setMessage("Your report was saved. You can see its review status on your dashboard.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setMessage("We couldn’t reach REVOK. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="report-form" onSubmit={submitReport}>
      <label className="auth-field">Item title
        <input name="title" required minLength={3} maxLength={100} placeholder="For example, black backpack" />
      </label>
      <label className="auth-field">Category
        <select name="category" required defaultValue="">
          <option value="" disabled>Select a category</option>
          {ITEM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
      </label>
      <label className="auth-field">Subcategory <small>(optional)</small>
        <input name="subcategory" maxLength={80} placeholder="For example, headphones or student ID" />
      </label>
      <div className="report-field-grid">
        <label className="auth-field">Brand <small>(optional)</small><input name="brand" maxLength={100} placeholder="Brand or manufacturer" /></label>
        <label className="auth-field">Model <small>(optional)</small><input name="model" maxLength={100} placeholder="Model or product name" /></label>
        <label className="auth-field">Color <small>(optional)</small><input name="color" maxLength={80} placeholder="Main color" /></label>
        <label className="auth-field">Material or appearance <small>(optional)</small><input name="material" maxLength={120} placeholder="Leather, metal, pattern…" /></label>
      </div>
      <label className="auth-field">Distinguishing marks <small>(optional)</small>
        <textarea name="identifyingMarks" maxLength={500} rows={2} placeholder="Stickers, scratches, accessories, or unique visible features" />
      </label>
      <label className="auth-field">Description
        <textarea name="description" required minLength={10} maxLength={2000} rows={5} placeholder="Describe identifying details. Keep serial numbers or unique proof private." />
      </label>
      <label className="auth-field">{isLost ? "Where did you last see it?" : "Where did you find it?"}
        <input name="location" required minLength={3} maxLength={180} placeholder="Use a general public place, not a home address" />
      </label>
      <label className="auth-field">{isLost ? "Date lost" : "Date found"}
        <input name="occurredAt" type="datetime-local" max={localDateTimeValue()} defaultValue={localDateTimeValue()} required />
      </label>
      <label className="auth-field">Approximate time <small>(optional)</small><input name="approximateTime" maxLength={80} placeholder="For example, around 2:30 pm" /></label>
      <label className="auth-field">More location detail <small>(optional)</small><textarea name="locationDetails" maxLength={300} rows={2} placeholder="Building, floor, classroom, or nearby landmark. Avoid private addresses." /></label>
      {isLost ? <label className="auth-field">Already contacted <small>(optional)</small><input name="contactedAbout" maxLength={200} placeholder="For example, library help desk" /></label> : <label className="auth-field">Where is the item now?
        <select name="custodyStatus" defaultValue="UNKNOWN"><option value="UNKNOWN">Not sure / prefer not to say</option><option value="WITH_FINDER">With me</option><option value="SECURITY_OFFICE">Submitted to a security office</option><option value="HANDED_OVER">Handed to an authorized person</option></select>
      </label>}
      <label className="auth-field">Private identifying detail <small>(optional, only you can see this)</small>
        <textarea name="privateDetails" maxLength={1000} rows={3} placeholder="For example, hidden contents or a detail someone must confirm to prove ownership" />
      </label>
      <div className="auth-field">
        <span>Photos <small>(optional, up to 3; JPEG, PNG, WebP; 5 MB each)</small></span>
        <label className={`image-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
          <strong>Choose photos or drag and drop</strong>
          <span>{isLost ? "A photo can help others recognize it; you can still report without one." : "A clear photo helps the owner identify the item. Cover ID numbers and other personal information before uploading."} Images upload when you submit.</span>
        </label>
        {photos.length > 0 && <div className="image-preview-grid">{photos.map(({ file, preview }, index) => <div className="image-preview-card" key={`${file.name}-${index}`}><Image src={preview} width={300} height={130} unoptimized alt={`Selected photo ${index + 1}`} /><button type="button" className="button button-outline" onClick={() => { URL.revokeObjectURL(preview); previewUrls.current.delete(preview); setPhotos((current) => current.filter((_, fileIndex) => fileIndex !== index)); }}>Remove</button></div>)}</div>}
      </div>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving report…" : isLost ? "Submit lost report" : "Submit found report"}</button>
      <p className="report-privacy-note">Reports are saved to your account and stay private while pending review. Approved reports and photos are public. Photo metadata is retained, so remove GPS/location data and avoid personal contact details before uploading.</p>
    </form>
  );
}
