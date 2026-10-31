"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import GooglePhoneVerification from "@/components/auth/GooglePhoneVerification";
import { usernameSchema } from "@/lib/validation/common";

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

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
  const [usernameSaved, setUsernameSaved] = useState(Boolean(initialUsername));
  const [availability, setAvailability] = useState("");
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (usernameSaved) return;
    const candidate = username.trim();
    if (!usernameSchema.safeParse(candidate).success) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability("Checking availability...");
      setAvailabilityState("checking");
      try {
        const response = await fetch(`/api/account/username?username=${encodeURIComponent(candidate)}`, { signal: controller.signal });
        const result = await response.json();
        if (controller.signal.aborted) return;
        setAvailability(result.message ?? (result.available ? "Username available." : "That username is already taken."));
        setAvailabilityState(result.available ? "available" : "taken");
      } catch {
        if (!controller.signal.aborted) {
          setAvailability("Could not check right now. The server will check when you save.");
          setAvailabilityState("error");
        }
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [username, usernameSaved]);

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = usernameSchema.safeParse(username.trim());
    if (!parsed.success) {
      setAvailability("Use 3-30 letters, numbers, underscores, or periods.");
      setAvailabilityState("invalid");
      return;
    }
    setSaving(true);
    setAvailability("");
    let refreshing = false;
    try {
      const response = await fetch("/api/account/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: parsed.data }),
      });
      const result = await response.json();
      if (!response.ok) {
        setAvailability(result.message ?? "Could not save this username.");
        setAvailabilityState(result.error === "USERNAME_TAKEN" ? "taken" : "error");
        return;
      }
      setUsername(result.username);
      setUsernameSaved(true);
      refreshing = true;
      router.refresh();
    } catch {
      setAvailability("Could not save this username. Please try again.");
      setAvailabilityState("error");
    } finally {
      if (!refreshing) setSaving(false);
    }
  }

  function updateUsername(value: string) {
    setUsername(value);
    const candidate = value.trim();
    if (!candidate) {
      setAvailability("");
      setAvailabilityState("idle");
    } else if (!usernameSchema.safeParse(candidate).success) {
      setAvailability("Use 3-30 letters, numbers, underscores, or periods.");
      setAvailabilityState("invalid");
    } else {
      setAvailability("Checking availability...");
      setAvailabilityState("checking");
    }
  }

  if (!usernameSaved) {
    return (
      <form className="auth-form" onSubmit={saveUsername}>
        <p className="auth-step"><strong>Step 1 of 2</strong> · Choose a username</p>
        <label className="auth-field" htmlFor="google-signup-username">Username
          <input id="google-signup-username" type="text" autoComplete="username" minLength={3} maxLength={30} value={username} onChange={(event) => updateUsername(event.target.value)} placeholder="Choose a username" required />
        </label>
        <p className="auth-help">Your username is permanent after you save it.</p>
        {availability && <p className={`username-availability username-${availabilityState}`} role="status">{availability}</p>}
        <button className="auth-submit" type="submit" disabled={saving || !usernameSchema.safeParse(username.trim()).success || availabilityState === "checking" || availabilityState === "taken"}>{saving ? "Saving..." : "Save username"}</button>
      </form>
    );
  }

  if (phoneVerified) {
    return <div className="auth-form"><p className="auth-help">Your account is set up as <strong>@{username}</strong>.</p><button className="auth-submit" type="button" onClick={() => router.replace("/")}>Continue to REVOK</button></div>;
  }

  return <div className="auth-form"><p className="auth-step"><strong>Step 2 of 2</strong> · Verify your phone</p><p className="auth-help">Permanent username: <strong>@{username}</strong></p><GooglePhoneVerification initialPhone={initialPhone} /></div>;
}
