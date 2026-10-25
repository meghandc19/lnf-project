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
      <label className="auth-field">Description
        <textarea name="description" required minLength={10} maxLength={2000} rows={5} placeholder="Describe identifying details. Keep serial numbers or unique proof private." />
      </label>
      <label className="auth-field">{isLost ? "Where did you last see it?" : "Where did you find it?"}
        <input name="location" required minLength={3} maxLength={180} placeholder="Use a general public place, not a home address" />
      </label>
      <label className="auth-field">{isLost ? "Date lost" : "Date found"}
        <input name="occurredAt" type="datetime-local" max={localDateTimeValue()} defaultValue={localDateTimeValue()} required />
      </label>
      <div className="auth-field">
        <span>Photos <small>(optional, up to 3; JPEG, PNG, WebP; 5 MB each)</small></span>
        <label className={`image-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
          <strong>Choose photos or drag and drop</strong>
          <span>Images are uploaded when you submit the report.</span>
        </label>
        {photos.length > 0 && <div className="image-preview-grid">{photos.map(({ file, preview }, index) => <div className="image-preview-card" key={`${file.name}-${index}`}><Image src={preview} width={300} height={130} unoptimized alt={`Selected photo ${index + 1}`} /><button type="button" className="button button-outline" onClick={() => { URL.revokeObjectURL(preview); previewUrls.current.delete(preview); setPhotos((current) => current.filter((_, fileIndex) => fileIndex !== index)); }}>Remove</button></div>)}</div>}
      </div>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving report…" : isLost ? "Submit lost report" : "Submit found report"}</button>
      <p className="report-privacy-note">Reports are saved to your account and stay private while pending review. Approved reports and photos are public. Photo metadata is retained, so remove GPS/location data and avoid personal contact details before uploading.</p>
    </form>
  );
}
