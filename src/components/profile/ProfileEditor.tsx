"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type ProfileData = { name: string; username: string | null; about: string | null; image: string | null };

export default function ProfileEditor({ user, canEdit }: { user: ProfileData; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [about, setAbout] = useState(user.about ?? "");
  const [image, setImage] = useState(user.image ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
      <form className="profile-card" onSubmit={saveProfile}>
        <div className="profile-preview">
          {image ? <Image src={image} width={66} height={66} alt="Profile preview" unoptimized referrerPolicy="no-referrer" /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase() || "R"}</span>}
          <div><strong>Profile photo</strong><p>Paste a secure image URL. Upload storage is not connected yet.</p></div>
        </div>
        <label className="auth-field">Photo URL
          <input type="url" inputMode="url" autoComplete="url" value={image} onChange={(event) => setImage(event.target.value)} placeholder="https://…" disabled={!canEdit} />
        </label>
        <label className="auth-field">Display name
          <input type="text" autoComplete="name" minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} required />
        </label>
        <label className="auth-field">About you
          <textarea maxLength={280} rows={4} value={about} onChange={(event) => setAbout(event.target.value)} placeholder="A short introduction (optional)" disabled={!canEdit} />
          <span className="field-hint">{about.length}/280 characters</span>
        </label>
        {user.username && <p className="profile-username">Username <strong>@{user.username}</strong><span>Usernames are currently fixed for sign-in stability.</span></p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        {canEdit && <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>}
      </form>
      <aside className="profile-side-card">
        <span className="profile-side-icon" aria-hidden="true">✳</span>
        <h2>Your community space</h2>
        <p>Your dashboard will gather your lost and found reports, matches, and the connections you help make. Item reporting is not connected yet, so no history is available to show.</p>
        <Link href="/dashboard" className="button button-primary">Go to dashboard <span aria-hidden="true">→</span></Link>
      </aside>
    </div>
  );
}
