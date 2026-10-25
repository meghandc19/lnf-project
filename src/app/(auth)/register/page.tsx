"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

type RegistrationStep = "phone" | "otp" | "details";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<RegistrationStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [usernameAvailability, setUsernameAvailability] = useState("");

  async function signUpWithGoogle() {
    setMessage("");
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/register/complete" });
    } catch {
      setMessage("Google sign-up is temporarily unavailable. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function sendOtp() {
    setLoading(true);
    setMessage("");
    const validation = indianPhoneSchema.safeParse(phoneNumber);
    if (!validation.success) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      setLoading(false);
      return;
    }

    const normalizedPhone = normalizeIndianPhone(phoneNumber);
    try {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber: normalizedPhone });
      if (result.error) {
        setMessage("Could not prepare a verification code. Check the local server and try again.");
        return;
      }
      setPhoneNumber(normalizedPhone);
      setStep("otp");
      setMessage("A development OTP was generated. Check the local Next.js terminal; no SMS is sent.");
    } catch {
      setMessage("Could not prepare a verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage("");
    try {
      const result = await authClient.phoneNumber.verify({ phoneNumber, code: otp });
      if (result.error) {
        setMessage("That code is invalid or expired. Check the terminal output or request a new code.");
        return;
      }
      setStep("details");
      setMessage("Phone verified. Complete your account details.");
    } catch {
      setMessage("Could not verify that code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function finishSignup() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Could not create the account. Check the details and try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setMessage("Could not create the account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function checkUsernameAvailability() {
    const candidate = username.trim();
    if (!candidate) {
      setUsernameAvailability("");
      return;
    }
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(candidate)) {
      setUsernameAvailability("Use 3–30 letters, numbers, underscores, or periods.");
      return;
    }
    setUsernameAvailability("Checking availability…");
    try {
      const response = await fetch(`/api/account/username?username=${encodeURIComponent(candidate)}`);
      const result = await response.json();
      setUsernameAvailability(result.message ?? (result.available ? "Username available." : "That username is already taken."));
    } catch {
      setUsernameAvailability("Could not check right now. We’ll still check when you create the account.");
    }
  }

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link href="/" className="brand"><Image src="/img/revok-logo.png" width={52} height={52} alt="" className="brand-logo" /><span>REVOK</span></Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">A community lost and found</p>
          <h1>Start with a little trust.</h1>
          <p>Phone verification helps prepare accounts for sensitive actions. Lost-and-found reporting is still being developed.</p>
        </div>
        <p className="auth-aside-note"><Link href="/">← Back to REVOK</Link></p>
      </aside>

      <section className="auth-main" aria-labelledby="register-heading">
        <div className="auth-card">
          <p className="eyebrow">Create your account</p>
          <h2 id="register-heading">Join REVOK</h2>
          <p className="auth-card-intro">A few steps, then you’re ready to continue.</p>
          <button className="auth-google-button" type="button" onClick={signUpWithGoogle} disabled={loading || googleLoading}>
            <span className="google-g" aria-hidden="true">G</span>{googleLoading ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="auth-divider">or sign up with phone</div>
          <p className="auth-step" aria-live="polite"><strong>{step === "phone" ? "1" : step === "otp" ? "2" : "3"} of 3</strong> · {step === "phone" ? "Verify your phone" : step === "otp" ? "Enter your code" : "Account details"}</p>

          {step === "phone" && (
            <div className="auth-form">
              <label className="auth-field" htmlFor="register-phone">Phone number
                <input id="register-phone" type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="98765 43210" required />
              </label>
              <p className="auth-help">Local development sends the code to the server terminal only. No SMS provider is contacted.</p>
              <button className="auth-submit" type="button" onClick={sendOtp} disabled={loading || !phoneNumber}>{loading ? "Preparing code…" : "Generate verification code"}</button>
            </div>
          )}

          {step === "otp" && (
            <div className="auth-form">
              <p className="auth-help">Enter the six-digit code printed in the local development terminal for {phoneNumber}.</p>
              <label className="auth-field" htmlFor="register-otp">Verification code
                <input id="register-otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} required />
              </label>
              <button className="auth-submit" type="button" onClick={verifyOtp} disabled={loading || otp.length !== 6}>{loading ? "Verifying…" : "Verify phone"}</button>
              <button className="button button-outline" type="button" onClick={() => { setStep("phone"); setMessage(""); setOtp(""); }}>Change phone number</button>
            </div>
          )}

          {step === "details" && (
            <div className="auth-form">
              <label className="auth-field" htmlFor="register-name">Name
                <input id="register-name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
              </label>
              <label className="auth-field" htmlFor="register-username">Username
                <input id="register-username" type="text" autoComplete="username" minLength={3} maxLength={30} value={username} onChange={(event) => { setUsername(event.target.value); setUsernameAvailability(""); }} onBlur={checkUsernameAvailability} placeholder="Choose a username" required />
              </label>
              <p className="auth-help username-lock-note">Check that your username is available. You can’t change it after account creation.</p>
              {usernameAvailability && <p className="username-availability" role="status">{usernameAvailability}</p>}
              <label className="auth-field" htmlFor="register-password">Password
                <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required />
              </label>
              <button className="auth-submit" type="button" onClick={finishSignup} disabled={loading || !name || !username || password.length < 8}>{loading ? "Creating account…" : "Create account"}</button>
            </div>
          )}

          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          <p className="auth-switch">Already registered? <Link href="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  );
}
