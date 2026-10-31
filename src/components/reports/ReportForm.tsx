"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ITEM_CATEGORIES } from "@/lib/items/categories";

const MAX_IMAGES = 3;
const MAX_LOST_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_FOUND_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const LOST_CATEGORIES = ["Electronics", "Wallets & bags", "ID & documents", "Keys", "Clothing", "Books & stationery", "Jewellery", "Other"] as const;

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function CameraCapture({ disabled, onCapture }: { disabled: boolean; onCapture: (file: File) => void }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [cameraMessage, setCameraMessage] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((nextStream) => {
        stream = nextStream;
        if (!active) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video) video.srcObject = nextStream;
      })
      .catch((error: unknown) => {
        if (!active) return;
        const name = error instanceof DOMException ? error.name : "";
        setCameraMessage(name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, then retry."
          : name === "NotFoundError"
            ? "No camera was found on this device. You can still submit the report without a photo."
            : "The camera could not be opened. Check browser permission and try again.");
      });
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [cameraOpen, retry]);

  function openCamera() {
    setCameraMessage("");
    setCaptureMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera access is not available in this browser. Try a current version of Chrome or Safari.");
      return;
    }
    setCameraOpen(true);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCaptureMessage("The camera is still starting. Wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCaptureMessage("This browser could not capture the photo. Please retry.");
      return;
    }
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.type !== "image/jpeg") {
      setCaptureMessage("The photo could not be prepared. Please take it again.");
      return;
    }
    if (blob.size >= MAX_FOUND_IMAGE_BYTES) {
      setCaptureMessage("Photo size exceeded. This image must be smaller than 4 MB. Move closer or try again.");
      return;
    }
    setCaptureMessage("");
    onCapture(new File([blob], `found-item-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  return (
    <div className="found-camera">
      {!cameraOpen ? <button className="button button-outline found-camera-open" type="button" disabled={disabled} onClick={openCamera}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>
        Open camera
      </button> : <div className="found-camera-panel">
        {cameraMessage ? <p className="auth-message report-upload-error" role="status">{cameraMessage}</p> : <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={(event) => { void event.currentTarget.play(); }} aria-label="Live camera preview" />}
        {captureMessage && <p className="auth-message report-upload-error" role="status">{captureMessage}</p>}
        <div className="found-camera-actions">
          {cameraMessage && <button className="button button-outline" type="button" onClick={() => { setCameraMessage(""); setRetry((value) => value + 1); }}>Retry camera</button>}
          {!cameraMessage && <button className="button button-primary" type="button" disabled={disabled} onClick={() => void capturePhoto()}>Capture photo</button>}
          <button className="button button-outline" type="button" onClick={() => setCameraOpen(false)}>Close camera</button>
        </div>
      </div>}
      <p className="report-field-help">Take a clear photo of the item. Avoid including faces, private documents, or sensitive information.</p>
      {cameraMessage && !cameraOpen && <p className="auth-message report-upload-error" role="status">{cameraMessage}</p>}
    </div>
  );
}

export default function ReportForm({ type }: { type: "LOST" | "FOUND" }) {
  const isLost = type === "LOST";
  const [category, setCategory] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const previewUrls = useRef(new Set<string>());
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState("");
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [foundLocation, setFoundLocation] = useState("");
  const [locationPreview, setLocationPreview] = useState("");
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function addFiles(selected: FileList | File[]) {
    const batch = Array.from(selected);
    const maxBytes = isLost ? MAX_LOST_IMAGE_BYTES : MAX_FOUND_IMAGE_BYTES;
    const valid = batch.filter((file) => {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      return (ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(extension)) && file.size > 0 && (isLost ? file.size <= maxBytes : file.size < maxBytes);
    });
    const slots = Math.max(0, MAX_IMAGES - photos.length);
    const additions = valid.slice(0, slots);
    const invalidCount = batch.length - valid.length;
    const overflowCount = valid.length - additions.length;
    const warnings = [
      invalidCount ? (isLost ? "Choose a non-empty JPEG, PNG, or WebP photo that is 3 MB or smaller." : "Use JPEG, PNG, or WebP photos that are smaller than 4 MB each.") : "",
      overflowCount ? "A report can include up to 3 photos." : "",
    ].filter(Boolean);
    setPhotoMessage(warnings.join(" "));
    if (additions.length) {
      setPhotos((current) => [...current, ...additions.map((file) => {
        const preview = URL.createObjectURL(file);
        previewUrls.current.add(preview);
        return { file, preview };
      })]);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function getCurrentLocation() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Location is unavailable in this browser. Enter a nearby public place manually.");
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationBusy(false);
        setFoundLocation((current) => current || "Near my current location");
        setLocationPreview(foundLocation
          ? "Your device location was checked. The place you entered was kept; exact coordinates are not stored."
          : "Added a general location to the field. Exact coordinates stay on this device; edit the text to name a nearby public place if you can.");
      },
      (error) => {
        setLocationBusy(false);
        setLocationMessage(error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. You can still enter the place manually."
          : "We could not get your location. You can still enter the place manually.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submitted) return;
    if (!event.currentTarget.checkValidity()) {
      setHasValidationErrors(true);
      setMessage("Complete the highlighted required fields before submitting.");
      event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus();
      return;
    }
    setHasValidationErrors(false);
    setMessage("");
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const occurredAtValue = String(form.get("occurredAt") ?? "");
      const occurredAt = new Date(occurredAtValue);
      if (!occurredAtValue || Number.isNaN(occurredAt.getTime())) {
        setMessage("Choose a valid date and time for when the item was lost or found.");
        return;
      }
      if (occurredAt.getTime() > Date.now()) {
        setMessage("The date and time cannot be in the future. Choose an earlier estimate.");
        return;
      }
      form.set("type", type);
      form.set("occurredAt", occurredAt.toISOString());
      if (isLost) {
        form.set("subcategory", String(form.get("category")) === "Other" ? String(form.get("otherItemType") ?? "") : "");
        form.set("occurredAtApproximate", form.has("occurredAtApproximate") ? "true" : "false");
      }
      for (const { file } of photos) form.append("images", file);
      const response = await fetch("/api/items", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "We couldn’t save the report. Check the required details and try again.");
        return;
      }
      setSubmitted(true);
      setSubmittedReportId(typeof result.report?.id === "string" ? result.report.id : "");
      setMessage("Your found report was submitted successfully. It will appear on your dashboard while it is reviewed.");
    } catch {
      setMessage("We couldn’t reach REVOK. Your details are still on this page; please try again.");
    } finally {
      setSaving(false);
    }
  }

  const foundPhotos = !isLost && <div className="auth-field found-photo-field">
    <span>Item Photo <small>(optional, up to 3)</small></span>
    <CameraCapture disabled={saving || submitted || photos.length >= MAX_IMAGES} onCapture={(file) => addFiles([file])} />
    <p className="report-photo-count" aria-live="polite">{photos.length} of 3 photos added. Each photo must be smaller than 4 MB.</p>
    {photoMessage && <p className="auth-message report-upload-error" role="alert">{photoMessage}</p>}
    {photos.length > 0 && <div className="image-preview-grid">{photos.map(({ file, preview }, index) => <div className="image-preview-card" key={`${file.name}-${index}`}>
      <Image src={preview} width={300} height={130} unoptimized alt={`Captured item photo ${index + 1}`} />
      <button type="button" className="button button-outline" disabled={saving || submitted} onClick={() => { URL.revokeObjectURL(preview); previewUrls.current.delete(preview); setPhotoMessage(""); setPhotos((current) => current.filter((_, fileIndex) => fileIndex !== index)); }}>Remove photo</button>
    </div>)}</div>}
  </div>;

  const lostPhotos = isLost && <div className="auth-field">
    <span>Item photos <small>(optional, up to 3)</small></span>
    <p className="report-field-help">Add up to 3 photos of your lost item. Each photo can be up to 3 MB; smaller photos are welcome.</p>
    {photos.length < MAX_IMAGES && <label className={`image-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
      <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple className="visually-hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
      <strong>Choose photos or drag and drop</strong>
      <span>Tap to choose JPEG, PNG, or WebP photos from your device.</span>
    </label>}
    <p className="report-field-help">Upload a genuine photo of the item. Do not upload AI-generated images, images focused on people, or images showing private or sensitive information. An incidental person in the background is okay.</p>
    <p className="report-photo-count" aria-live="polite">{photos.length} of 3 photos added.</p>
    {photoMessage && <p className="auth-message report-upload-error" role="status">{photoMessage}</p>}
    {photos.length > 0 && <div className="image-preview-grid">{photos.map(({ file, preview }, index) => <div className="image-preview-card" key={`${file.name}-${index}`}>
      <Image src={preview} width={300} height={130} unoptimized alt={`Selected photo ${index + 1}`} />
      <button type="button" className="button button-outline" onClick={() => { URL.revokeObjectURL(preview); previewUrls.current.delete(preview); setPhotoMessage(""); setPhotos((current) => current.filter((_, fileIndex) => fileIndex !== index)); }}>Remove</button>
    </div>)}</div>}
  </div>;

  return (
    <form className={`report-form${isLost ? " report-form-lost" : " report-form-found"}${hasValidationErrors ? " has-validation-errors" : ""}`} onSubmit={submitReport} noValidate={!isLost}>
      {isLost ? <label className="auth-field">Item name<input name="title" required minLength={3} maxLength={100} placeholder="e.g. Green backpack" /></label> : <>
        <section className="found-form-section" aria-labelledby="found-photo-heading"><div className="found-section-heading"><span className="found-section-number">01</span><h2 id="found-photo-heading">Item Photo</h2></div>{foundPhotos}</section>
        <section className="found-form-section" aria-labelledby="found-info-heading"><div className="found-section-heading"><span className="found-section-number">02</span><h2 id="found-info-heading">Item information</h2></div>
          <label className="auth-field">What did you find?<input name="title" required minLength={3} maxLength={100} placeholder="E.g., Black water bottle" /></label>
          <label className="auth-field">Category<select name="category" required defaultValue=""><option value="" disabled>Select a category</option>{ITEM_CATEGORIES.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}</select></label>
          <label className="auth-field">When did you find it?<input name="occurredAt" type="datetime-local" max={localDateTimeValue()} defaultValue={localDateTimeValue()} required /></label>
          <label className="auth-field">Describe the item<textarea name="description" required minLength={10} maxLength={2000} rows={3} placeholder="Add a few details that may help identify the item." /></label>
          <p className="report-safety-note">Do not include passwords, OTPs, PINs, bank details, or private identification numbers.</p>
        </section>
        <section className="found-form-section" aria-labelledby="found-location-heading"><div className="found-section-heading"><span className="found-section-number">03</span><h2 id="found-location-heading">Found location</h2></div>
          <label className="auth-field">Where did you find it?<input name="location" required minLength={3} maxLength={180} placeholder="Near the college library" value={foundLocation} onChange={(event) => { setFoundLocation(event.target.value); setLocationMessage(""); }} /></label>
          <button type="button" className="button button-outline found-location-button" onClick={getCurrentLocation} disabled={locationBusy || saving || submitted}>{locationBusy ? "Checking location…" : "Use my current location"}</button>
          {locationPreview && <p className="found-location-preview" role="status"><span aria-hidden="true">✓</span>{locationPreview}</p>}
          {locationMessage && <p className="auth-message report-upload-error" role="status">{locationMessage}</p>}
          <label className="auth-field">More location details <small>(optional)</small><textarea name="locationDetails" maxLength={300} rows={2} placeholder="E.g., Near the library entrance, beside the notice board" /></label>
        </section>
        <section className="found-form-section" aria-labelledby="found-custody-heading"><div className="found-section-heading"><span className="found-section-number">04</span><h2 id="found-custody-heading">Where is the item now?</h2></div>
          <p className="report-field-help">Let others know who is currently keeping the found item.</p>
          <fieldset className="found-custody-options"><legend className="visually-hidden">Choose who is keeping the item</legend>
            <label className="found-custody-card"><input type="radio" name="custodyStatus" value="WITH_FINDER" required /><span className="found-custody-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"/></svg></span><span><strong>With me</strong><small>I am keeping the item safely.</small></span></label>
            <label className="found-custody-card"><input type="radio" name="custodyStatus" value="HANDED_OVER" required /><span className="found-custody-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span><span><strong>With a REVOK Steward</strong><small>The item has been handed over to a trusted REVOK Steward.</small></span></label>
          </fieldset>
        </section>
        {<label className="auth-field">Private identifying detail <small>(optional)</small><textarea name="privateDetails" maxLength={1000} rows={2} placeholder="A private detail that can help confirm ownership" /></label>}
      </>}
      {isLost ? <>
        <label className="auth-field">Category<select name="category" required value={category} onChange={(event) => setCategory(event.target.value)}><option value="" disabled>Select a category</option>{LOST_CATEGORIES.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}</select></label>
        {category === "Other" && <label className="auth-field">What kind of item is it? <small>(optional)</small><input name="otherItemType" maxLength={80} placeholder="e.g. Umbrella, water bottle, lunch box" /></label>}
        <div className="report-field-grid"><label className="auth-field">Brand <small>(optional)</small><input name="brand" maxLength={100} placeholder="Brand or maker" /></label><label className="auth-field">Color <span className="report-required">Required</span><input name="color" maxLength={80} placeholder="Main color" required /></label></div>
        <label className="auth-field">Description<textarea name="description" required minLength={10} maxLength={2000} rows={4} placeholder="Describe visible features, color patterns, stickers, or damage that may help someone recognize the item." /></label><p className="report-safety-note">Never share passwords, OTPs, PINs, bank details, or other sensitive personal information.</p>
        <label className="auth-field">Last seen at<input name="location" required minLength={3} maxLength={180} placeholder="e.g. KVG College library" /><small className="report-field-help">Use a public place or general landmark. Do not enter your home address.</small></label>
        <label className="auth-field">Date and time lost<input name="occurredAt" type="datetime-local" max={localDateTimeValue()} defaultValue={localDateTimeValue()} required /><span className="report-checkbox-row"><input name="occurredAtApproximate" type="checkbox" value="true" /> <span>This date and time is approximate</span></span></label>
        {lostPhotos}
        <label className="auth-field">Private ownership detail (optional)<textarea name="privateDetails" maxLength={1000} rows={2} placeholder="Add a detail only the real owner is likely to know." /><small className="report-field-help">This detail is private and must never appear in public search results or public item pages.</small></label>
      </> : null}
      {message && <p className={`auth-message${submitted ? " found-success-message" : ""}`} role={submitted ? "status" : "alert"} aria-live="polite">{message}{submitted && <> <Link href="/dashboard">View dashboard</Link></>}</p>}
      {submitted && isLost && submittedReportId && <Link className="button button-outline" href={`/items/lost/${submittedReportId}`}>Review report and possible matches</Link>}
      <button className="auth-submit" type="submit" disabled={saving || submitted}>{saving ? "Submitting report…" : submitted ? "Report submitted" : isLost ? "Submit Lost Report" : "Submit Found Report"}</button>
      <p className="report-privacy-note">Reports are saved to your account and stay private while pending review. Approved reports and photos are public. Avoid personal contact details in public descriptions.</p>
    </form>
  );
}
