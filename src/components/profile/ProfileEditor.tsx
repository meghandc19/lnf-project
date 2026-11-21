"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import InventoryManager, { type InventoryEntry } from "@/components/profile/InventoryManager";
import FriendManager from "@/components/profile/FriendManager";

type ProfileData = { name: string; username: string | null; about: string | null; image: string | null; phoneNumber: string | null; phoneNumberVerified: boolean };

export default function ProfileEditor({ user, inventory, canEdit, hasGoogleAuth = false }: { user: ProfileData; inventory: InventoryEntry[]; canEdit: boolean; hasGoogleAuth?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [about, setAbout] = useState(user.about ?? "");
  const [image, setImage] = useState(user.image ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [newPhone, setNewPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [changingPhone, setChangingPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [googleMessage, setGoogleMessage] = useState("");

  async function handleLinkGoogle() {
    setLinkingGoogle(true);
    setGoogleMessage("");
    try {
      const result = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/profile?linked=google",
      });
      if (result && typeof result === "object" && "error" in result && result.error) {
        setGoogleMessage((result.error as { message?: string })?.message || "Failed to link Google account. Please try again.");
        setLinkingGoogle(false);
      }
    } catch {
      setGoogleMessage("Could not connect to Google. Please try again.");
      setLinkingGoogle(false);
    }
  }

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

  async function removePhoto() {
    if (!image || !canEdit || uploading || removingPhoto) return;
    setRemovingPhoto(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/profile/photo", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Could not remove your photo. Please try again.");
        return;
      }
      setImage("");
      setPhotoActionsOpen(false);
      setMessage("Your profile photo was removed.");
      router.refresh();
    } catch {
      setMessage("Could not remove your photo. Please try again.");
    } finally {
      setRemovingPhoto(false);
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
      setNewPhone("");
      setPhoneMessage("Your new phone number is verified. The previous number has been removed from this account.");
      router.refresh();
    } catch {
      setPhoneMessage("Could not verify this number. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function resendPhoneCode() {
    setPhoneLoading(true);
    setPhoneMessage("");
    try {
      const response = await fetch("/api/account/phone/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: newPhone }),
      });
      const result = await response.json();
      if (!response.ok) { setPhoneMessage(result.message ?? "Could not resend the code. Please try again later."); return; }
      setPhoneCode("");
      setPhoneMessage("A new verification code was sent.");
    } catch {
      setPhoneMessage("Could not resend the code. Please try again later.");
    } finally { setPhoneLoading(false); }
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
        {!hasGoogleAuth ? (
          <section className="profile-card profile-google-link-card" aria-labelledby="google-link-heading">
            <div className="google-link-banner-inner">
              <div className="google-link-icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>
              <div className="google-link-copy">
                <p className="eyebrow" style={{ color: "var(--green-deep)", marginBottom: "4px" }}>Fast 1-click login</p>
                <h2 id="google-link-heading" style={{ fontSize: "19px", margin: "0 0 6px", fontWeight: 700 }}>
                  Link Google Account
                </h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px", lineHeight: 1.55 }}>
                  Link your Google account for faster login. Next time, simply click &quot;Continue with Google&quot; to sign in instantly without typing your username or password — your phone number and account details remain fully connected.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
              <button
                type="button"
                className="button button-primary"
                onClick={handleLinkGoogle}
                disabled={linkingGoogle || !canEdit}
                style={{ display: "inline-flex", alignItems: "center", gap: "9px" }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{linkingGoogle ? "Connecting to Google…" : "Link Google Account"}</span>
              </button>
            </div>
            {googleMessage && <p className="auth-message" role="status">{googleMessage}</p>}
          </section>
        ) : (
          <section className="profile-card profile-google-linked-card" style={{ background: "#f5fbf7", borderColor: "#cce8d4", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "grid", placeItems: "center", width: "36px", height: "36px", borderRadius: "50%", background: "#d9f2e0", color: "var(--green-deep)" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div>
                <strong style={{ fontSize: "14px", color: "var(--green-deep)", display: "block" }}>Google Account Connected</strong>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Fast 1-click Google sign-in is active for your account.</span>
              </div>
            </div>
          </section>
        )}
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
          {image && <button className="button button-outline profile-photo-remove" type="button" disabled={uploading || removingPhoto} onClick={() => void removePhoto()}>Remove photo</button>}
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
        {canEdit && <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>}
      </form>
      <section className="profile-card phone-settings" aria-labelledby="phone-settings-heading">
        <div className="phone-settings-heading"><div><p className="eyebrow">Account security</p><h2 id="phone-settings-heading">Phone number</h2></div><span className={user.phoneNumberVerified ? "verified-chip" : "status-chip"}>{user.phoneNumberVerified ? "Verified" : "Not verified"}</span></div>
        <p className="profile-phone-current">{phoneNumber || "No phone number added"}</p>
        {canEdit && !changingPhone && <button className="button button-outline" type="button" onClick={() => { setChangingPhone(true); setPhoneStep("phone"); setPhoneMessage(""); }}>Change phone number</button>}
        {canEdit && changingPhone && (phoneStep === "phone" ? <form className="phone-change-form" onSubmit={sendPhoneCode}>
          <label className="auth-field">New phone number<input type="tel" inputMode="tel" autoComplete="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="98765 43210" required /></label>
          <p className="auth-help">Your current number stays on the account until you verify the new one.</p>
          <div className="button-row"><button className="button button-primary" type="submit" disabled={phoneLoading}>{phoneLoading ? "Sending…" : "Send verification code"}</button><button className="button button-outline" type="button" onClick={() => setChangingPhone(false)}>Cancel</button></div>
        </form> : <form className="phone-change-form" onSubmit={verifyNewPhone}>
          <p className="auth-help">Enter the 4-digit code sent to {newPhone}.</p>
          <label className="auth-field">Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} required /></label>
          <button className="button button-outline" type="button" onClick={resendPhoneCode} disabled={phoneLoading}>{phoneLoading ? "Sending…" : "Resend code"}</button>
          <div className="button-row"><button className="button button-primary" type="submit" disabled={phoneLoading || phoneCode.length !== 4}>{phoneLoading ? "Verifying…" : "Verify new number"}</button><button className="button button-outline" type="button" onClick={() => { setPhoneStep("phone"); setPhoneCode(""); setPhoneMessage(""); }}>Change number</button></div>
        </form>)}
        {phoneMessage && <p className="auth-message" role="status">{phoneMessage}</p>}
      </section>
      <InventoryManager initialItems={inventory} canEdit={canEdit} />
      <FriendManager canEdit={canEdit} />
      </div>
    </div>
  );
}
