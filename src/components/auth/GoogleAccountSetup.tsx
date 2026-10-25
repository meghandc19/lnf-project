"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import GooglePhoneVerification from "@/components/auth/GooglePhoneVerification";
import { usernameSchema } from "@/lib/validation/common";

export default function GoogleAccountSetup({
  initialUsername,
  initialPhone,
  phoneVerified,
}: {
  initialUsername: string;
  initialPhone: string;
  phoneVerified: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [availability, setAvailability] = useState("");
  const [saving, setSaving] = useState(false);

  async function checkAvailability() {
    const candidate = username.trim();
    const parsed = usernameSchema.safeParse(candidate);
    if (!parsed.success) {
      setAvailability("Use 3–30 letters, numbers, underscores, or periods.");
      return;
    }
    setAvailability("Checking availability…");
    try {
      const response = await fetch(`/api/account/username?username=${encodeURIComponent(candidate)}`);
      const result = await response.json();
      setAvailability(result.message ?? (result.available ? "Username available." : "That username is already taken."));
    } catch {
      setAvailability("Could not check right now. We’ll check again when you save.");
    }
  }

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = usernameSchema.safeParse(username.trim());
    if (!parsed.success) {
      setAvailability("Use 3–30 letters, numbers, underscores, or periods.");
      return;
    }
    setSaving(true);
    setAvailability("");
    try {
      const response = await fetch("/api/account/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: parsed.data }),
      });
      const result = await response.json();
      if (!response.ok) {
        setAvailability(result.message ?? "Could not save this username.");
        return;
      }
      setUsername(result.username);
      router.refresh();
    } catch {
      setAvailability("Could not save this username. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!username) {
    return (
      <form className="auth-form" onSubmit={saveUsername}>
        <p className="auth-step"><strong>Step 1 of 2</strong> · Choose a username</p>
        <label className="auth-field" htmlFor="google-signup-username">Username
          <input id="google-signup-username" type="text" autoComplete="username" minLength={3} maxLength={30} value={username} onChange={(event) => { setUsername(event.target.value); setAvailability(""); }} onBlur={() => { if (username) void checkAvailability(); }} placeholder="Choose a username" required />
        </label>
        <p className="auth-help">Your username is permanent after you create it.</p>
        {availability && <p className="username-availability" role="status">{availability}</p>}
        <button className="auth-submit" type="submit" disabled={saving || !username}>{saving ? "Saving…" : "Save username"}</button>
      </form>
    );
  }

  if (phoneVerified) {
    return <div className="auth-form"><p className="auth-help">Your account is set up as <strong>@{username}</strong>.</p><button className="auth-submit" type="button" onClick={() => { router.replace("/"); router.refresh(); }}>Continue to REVOK</button></div>;
  }

  return <div className="auth-form"><p className="auth-step"><strong>Step 2 of 2</strong> · Verify your phone</p><p className="auth-help">Permanent username: <strong>@{username}</strong></p><GooglePhoneVerification initialPhone={initialPhone} /></div>;
}
