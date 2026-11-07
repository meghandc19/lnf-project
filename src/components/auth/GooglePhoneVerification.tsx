"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (
      identifier: string,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string
    ) => void;
    verifyOtp?: (
      otp: string,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string
    ) => void;
  }
}

function extractAccessToken(data: unknown): string | null {
  if (typeof data === "string" && data.startsWith("ey")) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["token", "accessToken", "access-token", "message"]) {
      if (typeof obj[key] === "string" && (obj[key] as string).startsWith("ey")) {
        return obj[key] as string;
      }
    }
  }
  return null;
}

export default function GooglePhoneVerification({ initialPhone }: { initialPhone: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || "366b67695879383238353332";
    const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH || "";

    const script = document.createElement("script");
    script.src = "https://verify.msg91.com/otp-provider.js";
    script.async = true;
    script.onload = () => {
      if (window.initSendOTP) {
        window.initSendOTP({
          widgetId,
          tokenAuth,
          exposeMethods: true,
          success: (data: unknown) => {
            const token = extractAccessToken(data);
            if (token) {
              handleTokenVerification(token);
            }
          },
          failure: (error: unknown) => {
            console.error("MSG91 OTP failure:", error);
          },
        });
        setSdkReady(true);
      }
    };
    script.onerror = () => {
      console.warn("MSG91 script failed to load.");
    };
    document.body.appendChild(script);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
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

  async function handleTokenVerification(accessToken: string) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          accessToken,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Could not verify phone. Please try again.");
        setLoading(false);
        return;
      }
      router.replace("/");
    } catch {
      setMessage("Could not complete verification. Please try again.");
      setLoading(false);
    }
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
        setLoading(false);
        return;
      }

      setPhone(normalizedPhone);

      if (window.sendOtp) {
        window.sendOtp(
          `91${normalizedPhone}`,
          () => {
            setStep("otp");
            setMessage("4-digit verification code sent.");
            setLoading(false);
            startCooldown(30);
          },
          (error: unknown) => {
            const errObj = error as { message?: string } | undefined;
            setMessage(errObj?.message ?? "SMS delivery failed. Check the number and try again.");
            setLoading(false);
          }
        );
      } else {
        setStep("otp");
        setMessage("Verification code sent.");
        setLoading(false);
        startCooldown(30);
      }
    } catch {
      setMessage("Could not prepare verification code. Please try again.");
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

    if (window.verifyOtp) {
      window.verifyOtp(
        code,
        (data: unknown) => {
          const token = extractAccessToken(data);
          if (token) {
            handleTokenVerification(token);
          } else {
            setMessage("Verification failed. Please request a new code.");
            setLoading(false);
          }
        },
        (error: unknown) => {
          const errObj = error as { message?: string } | undefined;
          setMessage(errObj?.message ?? "Invalid or expired code. Please try again.");
          setLoading(false);
        }
      );
    } else {
      setMessage("Verification service is initializing. Please wait a moment.");
      setLoading(false);
    }
  }

  function resendOtp() {
    if (resendCooldown > 0 || resendCount >= 2) return;
    setLoading(true);
    setMessage("");

    if (window.retryOtp) {
      window.retryOtp(
        null,
        () => {
          setResendCount((prev) => prev + 1);
          setCode("");
          setMessage("A new 4-digit code was sent.");
          setLoading(false);
          startCooldown(30);
        },
        (error: unknown) => {
          const errObj = error as { message?: string } | undefined;
          setMessage(errObj?.message ?? "Could not resend the code. Please try again later.");
          setLoading(false);
        }
      );
    } else {
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
