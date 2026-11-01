"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import InventoryManager, { type InventoryEntry } from "@/components/profile/InventoryManager";
import FriendManager from "@/components/profile/FriendManager";

type ProfileData = { name: string; username: string | null; about: string | null; image: string | null; phoneNumber: string | null; phoneNumberVerified: boolean };

export default function ProfileEditor({ user, inventory, canEdit }: { user: ProfileData; inventory: InventoryEntry[]; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [about, setAbout] = useState(user.about ?? "");
  const [image, setImage] = useState(user.image ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [newPhone, setNewPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [changingPhone, setChangingPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [developmentPhoneCode, setDevelopmentPhoneCode] = useState("");

  async function uploadPhoto(file?: File) {
    if (!file || !canEdit) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const recognizedImage = file.type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp", ".heic", ".heif"].includes(extension);
    if (!recognizedImage || file.size > 3 * 1024 * 1024 || file.size === 0) {
      setMessage("Choose a valid image that is 3 MB or smaller. Small photos are welcome.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("image", file);
      const response = await fetch("/api/account/profile/photo", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Could not upload your photo. Please try again.");
        return;
      }
      setImage(result.image ?? "");
      setMessage("Photo uploaded. Save your profile to keep your other changes.");
      router.refresh();
    } catch {
      setMessage("Could not upload your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function sendPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneMessage("");
    const parsed = indianPhoneSchema.safeParse(newPhone);
    if (!parsed.success) {
      setPhoneMessage("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setPhoneLoading(true);
    const normalizedPhone = normalizeIndianPhone(newPhone);
    try {
      const response = await fetch("/api/account/phone/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalizedPhone }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPhoneMessage(result.message ?? result.error ?? "Could not send a verification code.");
        return;
      }
      setNewPhone(normalizedPhone);
      setDevelopmentPhoneCode(result.developmentCode ?? "");
      setPhoneStep("otp");
      setPhoneMessage(result.message ?? "Verification code sent.");
    } catch {
      setPhoneMessage("Could not send a verification code. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function verifyNewPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneLoading(true);
    setPhoneMessage("");
    try {
      const response = await fetch("/api/account/phone/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: newPhone, code: phoneCode }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPhoneMessage(result.message ?? result.error ?? "The code is invalid or expired.");
        return;
      }
      setPhoneNumber(newPhone);
      setChangingPhone(false);
      setPhoneStep("phone");
      setPhoneCode("");
      setDevelopmentPhoneCode("");
      setNewPhone("");
      setPhoneMessage("Your new phone number is verified. The previous number has been removed from this account.");
      router.refresh();
    } catch {
      setPhoneMessage("Could not verify this number. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, about, image }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Could not save your profile. Please try again.");
        return;
      }
      setMessage("Your profile has been saved.");
      router.refresh();
    } catch {
      setMessage("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-layout">
      <div className="profile-editor-stack">
      <form className="profile-card" onSubmit={saveProfile}>
        <div className="profile-preview">
          <button className="profile-avatar-edit" type="button" disabled={!canEdit} onClick={() => setPhotoActionsOpen((open) => !open)} aria-expanded={photoActionsOpen} aria-label="Edit profile photo">
            {image ? <Image src={image} width={92} height={92} alt="Profile photo" unoptimized referrerPolicy="no-referrer" /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase() || "R"}</span>}
            <span className="profile-avatar-pencil" aria-hidden="true">✎</span>
          </button>
          <div><strong>Profile photo</strong><p>Profile photos are public. Remove location metadata before uploading.</p></div>
        </div>
        {canEdit && photoActionsOpen && <div className="profile-photo-actions">
          <label className="button button-outline profile-photo-change">{uploading ? "Uploading photo…" : "Change photo"}<input type="file" accept="image/*" className="visually-hidden" disabled={uploading} onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          {image && <button className="button button-outline profile-photo-remove" type="button" disabled={uploading} onClick={() => { setImage(""); setPhotoActionsOpen(false); setMessage("Photo removed. Save your profile to apply this change."); }}>Remove photo</button>}
          <span>Common image formats · up to 3 MB</span>
        </div>}
        <label className="auth-field">Display name
          <input type="text" autoComplete="name" minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} required />
        </label>
        <label className="auth-field">About you
          <textarea maxLength={280} rows={4} value={about} onChange={(event) => setAbout(event.target.value)} placeholder="A short introduction (optional)" disabled={!canEdit} />
          <span className="field-hint">{about.length}/280 characters</span>
        </label>
        {user.username && <p className="profile-username">Username <strong>@{user.username}</strong><span>Your username is permanent and cannot be changed.</span></p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        {canEdit && <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Savingâ€¦" : "Save profile"}</button>}
      </form>
      <section className="profile-card phone-settings" aria-labelledby="phone-settings-heading">
        <div className="phone-settings-heading"><div><p className="eyebrow">Account security</p><h2 id="phone-settings-heading">Phone number</h2></div><span className={user.phoneNumberVerified ? "verified-chip" : "status-chip"}>{user.phoneNumberVerified ? "Verified" : "Not verified"}</span></div>
        <p className="profile-phone-current">{phoneNumber || "No phone number added"}</p>
        {canEdit && !changingPhone && <button className="button button-outline" type="button" onClick={() => { setChangingPhone(true); setPhoneStep("phone"); setPhoneMessage(""); }}>Change phone number</button>}
        {canEdit && changingPhone && (phoneStep === "phone" ? <form className="phone-change-form" onSubmit={sendPhoneCode}>
          <label className="auth-field">New phone number<input type="tel" inputMode="tel" autoComplete="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="98765 43210" required /></label>
          <p className="auth-help">Your current number stays on the account until you verify the new one.</p>
          <div className="button-row"><button className="button button-primary" type="submit" disabled={phoneLoading}>{phoneLoading ? "Sendingâ€¦" : "Send verification code"}</button><button className="button button-outline" type="button" onClick={() => setChangingPhone(false)}>Cancel</button></div>
        </form> : <form className="phone-change-form" onSubmit={verifyNewPhone}>
          <p className="auth-help">Enter the six-digit code sent to {newPhone}.</p>
          {developmentPhoneCode && <p className="local-dev-code" role="status">Local development code: <strong>{developmentPhoneCode}</strong><span>Expires in 5 minutes.</span></p>}
          <label className="auth-field">Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} required /></label>
          <div className="button-row"><button className="button button-primary" type="submit" disabled={phoneLoading || phoneCode.length !== 6}>{phoneLoading ? "Verifyingâ€¦" : "Verify new number"}</button><button className="button button-outline" type="button" onClick={() => { setPhoneStep("phone"); setPhoneCode(""); setPhoneMessage(""); }}>Change number</button></div>
        </form>)}
        {phoneMessage && <p className="auth-message" role="status">{phoneMessage}</p>}
      </section>
      <InventoryManager initialItems={inventory} canEdit={canEdit} />
      <FriendManager canEdit={canEdit} />
      </div>
    </div>
  );
}
