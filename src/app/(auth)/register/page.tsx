"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { indianPhoneSchema, normalizeIndianPhone, usernameSchema } from "@/lib/validation/common";
import styles from "../AuthPages.module.css";

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

type RegistrationStep = "phone" | "otp" | "details";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<RegistrationStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [usernameAvailability, setUsernameAvailability] = useState("");
  const [usernameAvailabilityState, setUsernameAvailabilityState] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "error"
  >("idle");
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
              setAccessToken(token);
              setStep("details");
              setMessage("Phone verified. Complete your account details.");
            }
          },
          failure: (error: unknown) => {
            console.error("MSG91 OTP failure:", error);
          },
        });
      }
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

  useEffect(() => {
    if (step !== "details") return;
    const candidate = username.trim();
    if (!usernameSchema.safeParse(candidate).success) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUsernameAvailability("Checking availability...");
      setUsernameAvailabilityState("checking");
      try {
        const response = await fetch(
          `/api/account/username?username=${encodeURIComponent(candidate)}`,
          { signal: controller.signal }
        );
        const result = await response.json();
        if (controller.signal.aborted) return;
        setUsernameAvailability(
          result.message ?? (result.available ? "Username available." : "That username is already taken.")
        );
        setUsernameAvailabilityState(result.available ? "available" : "taken");
      } catch {
        if (!controller.signal.aborted) {
          setUsernameAvailability("Could not check right now. The server will check when you save.");
          setUsernameAvailabilityState("error");
        }
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [step, username]);

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

  async function sendOtp(event?: FormEvent) {
    if (event) event.preventDefault();
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
      const response = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalizedPhone }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "Could not prepare a verification code. Please try again.");
        setLoading(false);
        return;
      }
      setPhoneNumber(normalizedPhone);

      const digits = normalizedPhone.replace(/\D/g, "");
      if (window.sendOtp) {
        window.sendOtp(
          digits.startsWith("91") ? digits : `91${digits}`,
          () => {
            setOtp("");
            setStep("otp");
            setMessage("4-digit verification code sent.");
            setLoading(false);
            startCooldown(30);
          },
          (error: unknown) => {
            const errObj = error as { message?: string } | undefined;
            setMessage(errObj?.message || "SMS delivery failed. Check the number and try again.");
            setLoading(false);
          }
        );
      } else {
        setOtp("");
        setStep("otp");
        setMessage("Verification code sent.");
        setLoading(false);
        startCooldown(30);
      }
    } catch {
      setMessage("Could not prepare a verification code. Please try again.");
      setLoading(false);
    }
  }

  function verifyOtp(event?: FormEvent) {
    if (event) event.preventDefault();
    if (otp.length !== 4) {
      setMessage("Enter the 4-digit verification code.");
      return;
    }
    setLoading(true);
    setMessage("");

    if (window.verifyOtp) {
      window.verifyOtp(
        otp,
        (data: unknown) => {
          const token = extractAccessToken(data);
          if (token) {
            setAccessToken(token);
            setStep("details");
            setMessage("Phone verified. Complete your account details.");
          } else {
            setMessage("Verification failed. Please request a new code.");
          }
          setLoading(false);
        },
        (error: unknown) => {
          const errObj = error as { message?: string } | undefined;
          setMessage(errObj?.message || "Invalid or expired code. Please try again.");
          setLoading(false);
        }
      );
    } else {
      setMessage("Verification service is initializing. Please wait.");
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
          setOtp("");
          setMessage("A new 4-digit code was sent.");
          setLoading(false);
          startCooldown(30);
        },
        (error: unknown) => {
          const errObj = error as { message?: string } | undefined;
          setMessage(errObj?.message || "Could not resend the code. Please try again later.");
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }
  }

  async function finishSignup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const parsedUsername = usernameSchema.safeParse(username.trim());
    if (!parsedUsername.success) {
      setMessage("Use 3–8 letters, numbers, underscores, or @.");
      setLoading(false);
      return;
    }

    if (password.length < 4 || password.length > 8) {
      setMessage("Password must be between 4 and 8 characters.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          accessToken,
          name: name.trim(),
          username: parsedUsername.data,
          password,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Could not create the account. Check details and try again.");
        setLoading(false);
        return;
      }

      // Automatically sign in the user with credentials
      await authClient.signIn.username(
        {
          username: parsedUsername.data,
          password,
          rememberMe: true,
        },
        {
          onSuccess: () => {
            router.push("/");
            router.refresh();
          },
          onError: () => {
            router.push("/login");
          },
        }
      );
    } catch {
      setMessage("Could not create the account. Please try again.");
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
          <p className="eyebrow">A community lost and found</p>
          <h1>Start with a little trust.</h1>
          <p>
            Phone verification helps protect your account for community reporting and secure returns.
          </p>
        </div>
        <p className="auth-aside-note">
          <Link href="/">← Back to REVOK</Link>
        </p>
      </aside>

      <section className="auth-main" aria-labelledby="register-heading">
        <div className="auth-card">
          <p className="eyebrow">Create your account</p>
          <h2 id="register-heading">Join REVOK</h2>
          <p className="auth-card-intro">Choose how you’d like to get started.</p>

          <button
            className="auth-google-button"
            type="button"
            onClick={signUpWithGoogle}
            disabled={loading || googleLoading}
          >
            <span className="google-g" aria-hidden="true">
              G
            </span>
            {googleLoading ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="auth-divider">or sign up with phone</div>

          <p className="auth-step" aria-live="polite">
            <strong>{step === "phone" ? "1" : step === "otp" ? "2" : "3"} of 3</strong> ·{" "}
            {step === "phone"
              ? "Verify your phone"
              : step === "otp"
                ? "Enter your code"
                : "Account details"}
          </p>

          {step === "phone" && (
            <form className="auth-form" onSubmit={sendOtp}>
              <label className="auth-field" htmlFor="register-phone">
                Phone number
                <input
                  id="register-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="98765 43210"
                  required
                />
              </label>
              <p className="auth-help">We’ll send a 4-digit verification code to this number.</p>
              <button
                className="auth-submit"
                type="submit"
                disabled={loading || !phoneNumber}
              >
                {loading ? "Sending code…" : "Send verification code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form className="auth-form" onSubmit={verifyOtp}>
              <p className="auth-help">Enter the 4-digit code sent to {phoneNumber}.</p>
              <label className="auth-field" htmlFor="register-otp">
                Verification code
                <input
                  id="register-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="0000"
                  maxLength={4}
                  required
                />
              </label>
              <button
                className="auth-submit"
                type="submit"
                disabled={loading || otp.length !== 4}
              >
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
                <p className="auth-help" style={{ color: "#8a4b4b" }}>
                  Maximum resends reached. Please try again later.
                </p>
              )}
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setStep("phone");
                  setMessage("");
                  setOtp("");
                }}
              >
                Change phone number
              </button>
            </form>
          )}

          {step === "details" && (
            <form className="auth-form" onSubmit={finishSignup}>
              <label className="auth-field" htmlFor="register-name">
                Full name
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>
              <label className="auth-field" htmlFor="register-username">
                Username
                <input
                  id="register-username"
                  type="text"
                  autoComplete="username"
                  minLength={3}
                  maxLength={8}
                  value={username}
                  onChange={(event) => {
                    const value = event.target.value;
                    const candidate = value.trim();
                    setUsername(value);
                    if (!candidate) {
                      setUsernameAvailability("");
                      setUsernameAvailabilityState("idle");
                    } else if (!usernameSchema.safeParse(candidate).success) {
                      setUsernameAvailability("Use 3–8 letters, numbers, underscores, or @.");
                      setUsernameAvailabilityState("invalid");
                    } else {
                      setUsernameAvailability("Checking availability...");
                      setUsernameAvailabilityState("checking");
                    }
                  }}
                  placeholder="3-8 characters"
                  required
                />
              </label>
              <p className="auth-help username-lock-note">
                Your username is permanent and cannot be changed after account creation.
              </p>
              {usernameAvailability && (
                <p
                  className={`username-availability username-${usernameAvailabilityState}`}
                  role="status"
                >
                  {usernameAvailability}
                </p>
              )}
              <label className="auth-field" htmlFor="register-password">
                Password
                <PasswordInput
                  id="register-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="4 to 8 characters"
                  minLength={4}
                  maxLength={8}
                  required
                />
              </label>
              <button
                className="auth-submit"
                type="submit"
                disabled={
                  loading ||
                  !name.trim() ||
                  !usernameSchema.safeParse(username.trim()).success ||
                  password.length < 4 ||
                  password.length > 8 ||
                  usernameAvailabilityState === "checking" ||
                  usernameAvailabilityState === "taken"
                }
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}

          {message && (
            <p className="auth-message" role="status" aria-live="polite">
              {message}
            </p>
          )}

          <p className="auth-switch">
            Already registered? <Link href="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
