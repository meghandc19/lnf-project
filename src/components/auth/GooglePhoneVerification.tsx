"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

export default function GooglePhoneVerification({ initialPhone }: { initialPhone: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  function startCooldown(seconds = 30) {
    setResendCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

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
        setMessage(result.message ?? "Could not send verification code.");
        return;
      }

      setPhone(normalizedPhone);
      setStep("otp");
      setMessage(result.message ?? "A 4-digit verification code was sent by SMS.");
      startCooldown(30);
    } catch {
      setMessage("Could not connect to the verification service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (code.length !== 4) {
      setMessage("Enter the 4-digit verification code.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch("/api/account/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, code }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Invalid or expired code. Please try again.");
        return;
      }
      router.replace("/");
    } catch {
      setMessage("Could not complete verification. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resendOtp() {
    if (resendCooldown > 0 || resendCount >= 2) return;
    setLoading(true);
    setMessage("");
    void fetch("/api/account/phone/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: phone }),
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Could not resend the code. Please try again later.");
        return;
      }
      setResendCount((prev) => prev + 1);
      setCode("");
      setMessage(result.message ?? "A new 4-digit code was sent.");
      startCooldown(30);
    }).catch(() => {
      setMessage("Could not resend the code. Please try again later.");
    }).finally(() => {
      setLoading(false);
    });
  }

  return (
    <>
      {step === "phone" ? (
        <form className="auth-form" onSubmit={sendOtp}>
          <label className="auth-field" htmlFor="google-signup-phone">Phone number
            <input
              id="google-signup-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98765 43210"
              required
            />
          </label>
          <p className="auth-help">We’ll send a 4-digit verification code to this Indian mobile number.</p>
          <button className="auth-submit" type="submit" disabled={loading || !phone}>
            {loading ? "Sending code…" : "Send verification code"}
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={() => router.replace("/")}
          >
            Skip for now
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={verifyPhone}>
          <p className="auth-help">Enter the 4-digit code sent to +91 {phone}.</p>
          <label className="auth-field" htmlFor="google-signup-otp">Verification code
            <input
              id="google-signup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              maxLength={4}
              required
            />
          </label>
          <button className="auth-submit" type="submit" disabled={loading || code.length !== 4}>
            {loading ? "Verifying…" : "Verify phone"}
          </button>
          {resendCount < 2 ? (
            <button
              className="button button-outline"
              type="button"
              onClick={resendOtp}
              disabled={loading || resendCooldown > 0}
            >
          {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          ) : (
            <p className="auth-help" style={{ color: "#8a4b4b" }}>Maximum resends reached. Please try again later.</p>
          )}
          <button
            className="button button-outline"
            type="button"
            onClick={() => { setStep("phone"); setCode(""); setMessage(""); }}
          >
            Change phone number
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={() => router.replace("/")}
          >
            Skip for now
          </button>
        </form>
      )}
      {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
    </>
  );
}
