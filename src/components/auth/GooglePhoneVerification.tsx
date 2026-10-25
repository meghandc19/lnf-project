"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

export default function GooglePhoneVerification({ initialPhone }: { initialPhone: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const parsed = indianPhoneSchema.safeParse(phone);
    if (!parsed.success) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setLoading(true);
    const normalizedPhone = normalizeIndianPhone(phone);
    try {
      const response = await fetch("/api/account/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalizedPhone }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? result.error ?? "Could not prepare a code. Please try again.");
        return;
      }
      setPhone(normalizedPhone);
      setStep("otp");
      setMessage("A development code was generated. Check the local Next.js terminal; no SMS is sent.");
    } catch {
      setMessage("Could not prepare a verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, code }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? result.error ?? "That code is invalid or expired. Check the terminal and try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Could not verify that code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {step === "phone" ? (
        <form className="auth-form" onSubmit={sendOtp}>
          <label className="auth-field" htmlFor="google-signup-phone">Phone number
            <input id="google-signup-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="98765 43210" required />
          </label>
          <p className="auth-help">Local testing prints the code in the development server terminal. No SMS is sent.</p>
          <button className="auth-submit" type="submit" disabled={loading || !phone}>{loading ? "Preparing code…" : "Send verification code"}</button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={verifyPhone}>
          <p className="auth-help">Enter the six-digit code printed for {phone} in the local development terminal.</p>
          <label className="auth-field" htmlFor="google-signup-otp">Verification code
            <input id="google-signup-otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} required />
          </label>
          <button className="auth-submit" type="submit" disabled={loading || code.length !== 6}>{loading ? "Verifying…" : "Verify phone"}</button>
          <button className="button button-outline" type="button" onClick={() => { setStep("phone"); setCode(""); setMessage(""); }}>Change phone number</button>
        </form>
      )}
      {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
    </>
  );
}
