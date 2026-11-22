"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import styles from "../AuthPages.module.css";

type ResetStep = "phone" | "otp" | "password" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const validation = indianPhoneSchema.safeParse(phone);
    if (!validation.success) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    const normalized = normalizeIndianPhone(phone);

    try {
      const response = await fetch("/api/auth/password/reset/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalized }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Could not request a password reset.");
        setLoading(false);
        return;
      }

      if (result.resetToken) {
        setResetToken(result.resetToken);
      }

      setPhone(normalized);
      setStep("otp");
      setMessage(result.message || "A 4-digit verification code has been sent.");
      startCooldown(30);
    } catch {
      setMessage("Could not connect to the reset service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleProceedToPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!/^\d{4}$/.test(otp)) {
      setMessage("Enter the 4-digit verification code sent to your phone.");
      return;
    }
    setStep("password");
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resendCount >= 2 || !resetToken) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/password/reset/retry-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, resetToken }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Could not resend code. Please try again later.");
        setLoading(false);
        return;
      }
      setResendCount((prev) => prev + 1);
      setOtp("");
      setMessage(result.message || "A new 4-digit code was sent.");
      startCooldown(30);
    } catch {
      setMessage("Failed to connect to resend service.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword.length < 8 || newPassword.length > 128) {
      setMessage("Password must be between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          resetToken,
          otp,
          newPassword,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Could not reset password. Please try again.");
        if (result.error === "INVALID_OTP") {
          // Allow returning to otp step to correct
          setStep("otp");
        }
        setLoading(false);
        return;
      }

      setStep("success");
      setMessage(result.message || "Password reset successfully.");
    } catch {
      setMessage("Could not complete password reset. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`auth-page ${styles.authPage}`}>
      <aside className="auth-aside">
        <Link href="/" className="brand">
          <Image src="/img/revok-logo.png" width={52} height={52} alt="" className="brand-logo" />
          <span>REVOK</span>
        </Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">Account Recovery</p>
          <h1>Reset your password</h1>
          <p>We&apos;ll verify your identity through your registered phone number to safely update your password.</p>
        </div>
        <p className="auth-aside-note">
          <Link href="/login">← Back to Login</Link>
        </p>
      </aside>

      <section className="auth-main" aria-labelledby="reset-heading">
        <div className="auth-card">
          <p className="eyebrow">Security</p>
          <h2 id="reset-heading">Password Recovery</h2>
          <p className="auth-card-intro">
            {step === "phone" && "Enter your registered Indian phone number."}
            {step === "otp" && `Enter the 4-digit code sent to ${phone}.`}
            {step === "password" && "Choose a new password between 8 and 128 characters."}
            {step === "success" && "Your password has been updated."}
          </p>

          {step === "phone" && (
            <form className="auth-form" onSubmit={handleRequestOtp}>
              <label className="auth-field" htmlFor="reset-phone">
                Phone number
                <input
                  id="reset-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
              </label>
              <p className="auth-help">One reset request allowed per account per 24 hours.</p>
              <button className="auth-submit" type="submit" disabled={loading || !phone}>
                {loading ? "Checking..." : "Send verification code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form className="auth-form" onSubmit={handleProceedToPassword}>
              <label className="auth-field" htmlFor="reset-otp">
                4-Digit verification code
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="0000"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  required
                />
              </label>
              <button className="auth-submit" type="submit" disabled={loading || otp.length !== 4}>
                Continue to set new password
              </button>
              {resendCount < 2 ? (
                <button
                  className="button button-outline"
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
              ) : (
                <p className="auth-help" style={{ color: "#8a4b4b" }}>
                  Maximum resends reached for this session.
                </p>
              )}
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setMessage("");
                }}
              >
                Change phone number
              </button>
            </form>
          )}

          {step === "password" && (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <label className="auth-field" htmlFor="reset-new-password">
                New password
                <PasswordInput
                  id="reset-new-password"
                  autoComplete="new-password"
                  placeholder="8 to 128 characters"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              <label className="auth-field" htmlFor="reset-confirm-password">
                Confirm new password
                <PasswordInput
                  id="reset-confirm-password"
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              <button
                className="auth-submit"
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword.length > 128 || newPassword !== confirmPassword}
              >
                {loading ? "Updating password..." : "Update password"}
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => setStep("otp")}
              >
                ← Back to verification code
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="auth-form">
              <p className="auth-help" style={{ color: "#087c48", fontWeight: 600 }}>
                Your password was reset successfully. All previous sessions have been signed out.
              </p>
              <button className="auth-submit" type="button" onClick={() => router.push("/login")}>
                Proceed to Log in
              </button>
            </div>
          )}

          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}

          <p className="auth-switch">
            Remember your password? <Link href="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
