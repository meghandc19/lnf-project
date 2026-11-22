"use client";

import { type FormEvent, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";
import styles from "../AuthPages.module.css";

function returnPath() {
  const requested = new URL(window.location.href).searchParams.get("callbackURL");
  if (!requested) return "/auth/continue";
  try {
    const target = new URL(requested, window.location.origin);
    return target.origin === window.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const authAttemptRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authAttemptRef.current) return;
    authAttemptRef.current = true;
    setMessage("");
    setLoading(true);

    const callbacks = {
      onSuccess: () => {
        router.push(returnPath());
      },
      onError: () => {
        setMessage("Sign-in unsuccessful. Check your details or try again.");
        setLoading(false);
        authAttemptRef.current = false;
      },
    };

    if (!password || password.length > 128) {
      setMessage("Enter your password (up to 128 characters).");
      setLoading(false);
      authAttemptRef.current = false;
      return;
    }

    try {
      if (indianPhoneSchema.safeParse(identifier).success) {
        await authClient.signIn.phoneNumber({
          phoneNumber: normalizeIndianPhone(identifier),
          password,
          rememberMe: true,
        }, callbacks);
        return;
      }
      const usernameValue = identifier.trim();
      if (!/^[a-zA-Z0-9_@]{3,8}$/.test(usernameValue)) {
        setMessage("Enter your username or a valid Indian phone number.");
        setLoading(false);
        authAttemptRef.current = false;
        return;
      }
      await authClient.signIn.username({
        username: usernameValue,
        password,
        rememberMe: true,
      }, callbacks);
    } catch {
      setMessage("Sign-in is temporarily unavailable. Please try again.");
      setLoading(false);
      authAttemptRef.current = false;
    }
  }

  async function handleGoogleLogin() {
    if (authAttemptRef.current) return;
    authAttemptRef.current = true;
    setMessage("");
    setGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: returnPath(),
        fetchOptions: { timeout: 20000 },
      });
      if (result.error || !result.data?.url || !result.data.redirect) {
        setMessage("Google sign-in is temporarily unavailable. Please try again.");
        setGoogleLoading(false);
        authAttemptRef.current = false;
      }
    } catch {
      setMessage("Google sign-in is temporarily unavailable. Please try again.");
      setGoogleLoading(false);
      authAttemptRef.current = false;
    }
  }

  return (
    <main className={`auth-page ${styles.authPage}`}>
      <aside className="auth-aside">
        <Link href="/" className="brand"><Image src="/img/revok-logo.png" width={52} height={52} alt="" className="brand-logo" /><span>REVOK</span></Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">A community lost and found</p>
          <h1>Good to have you back.</h1>
          <p>Sign in to your REVOK account. Lost-and-found reports are being prepared and are not available yet.</p>
        </div>
        <p className="auth-aside-note"><Link href="/">← Back to REVOK</Link></p>
      </aside>

      <section className="auth-main" aria-labelledby="login-heading">
        <div className="auth-card">
          <p className="eyebrow">Your account</p>
          <h2 id="login-heading">Log in</h2>
          <p className="auth-card-intro">Use your username or verified phone number and password.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <input
                type="text"
                inputMode="text"
                autoComplete="username"
                aria-label="Username or phone number"
                placeholder="Username or phone number"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              Password
              <PasswordInput
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                maxLength={128}
                required
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-4px", marginBottom: "6px" }}>
              <Link href="/forgot-password" className="text-link" style={{ fontSize: "13px" }}>
                Forgot password?
              </Link>
            </div>
            <button className="auth-submit" type="submit" disabled={loading || googleLoading}>
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>

          <div className="auth-divider">or</div>
          <button className="button button-outline" style={{ width: "100%" }} type="button" onClick={handleGoogleLogin} disabled={loading || googleLoading}>
            {googleLoading ? "Connecting to Google…" : "Continue with Google"}
          </button>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <p className="auth-switch">New to REVOK? <Link href="/register">Create an account</Link></p>
        </div>
      </section>
    </main>
  );
}
