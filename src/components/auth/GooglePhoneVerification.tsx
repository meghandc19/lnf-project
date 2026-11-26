"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMsg91OtpWidget } from "@/lib/auth/use-msg91-widget";
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

  const { isConfigured, widgetReady, sendWidgetOtp, verifyWidgetOtp, retryWidgetOtp } =
    useMsg91OtpWidget({ onInitError: setMessage });

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
    if (!isConfigured) {
      setMessage("Phone verification is unavailable because the MSG91 browser configuration is missing. Please contact support.");
      return;
    }
    if (!widgetReady) {
      setMessage("MSG91 phone verification is still loading or unavailable. Refresh the page and try again.");
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

      const sendResult = await sendWidgetOtp(normalizedPhone);
      if (!sendResult.ok) {
        setMessage(sendResult.error);
        return;
      }

      setPhone(normalizedPhone);
      setCode("");
      setResendCount(0);
      setStep("otp");
      setMessage("4-digit verification code sent by SMS.");
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
      const widgetResult = await verifyWidgetOtp(code);
      if (!widgetResult.ok) {
        setMessage(widgetResult.error);
        return;
      }

      const response = await fetch("/api/account/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, accessToken: widgetResult.accessToken }),
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

  async function resendOtp() {
    if (resendCooldown > 0 || resendCount >= 2) return;
    setLoading(true);
    setMessage("");
    try {
      const retryResult = await retryWidgetOtp(null);
      if (!retryResult.ok) {
        setMessage(retryResult.error);
        return;
      }
      setResendCount((prev) => prev + 1);
      setCode("");
      setMessage("A new 4-digit code was sent.");
      startCooldown(30);
    } catch {
      setMessage("Could not resend the code. Please try again later.");
    } finally {
      setLoading(false);
    }
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
