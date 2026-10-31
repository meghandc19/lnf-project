"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { indianPhoneSchema, normalizeIndianPhone } from "@/lib/validation/common";

type LoginMethod = "username" | "phone";

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
  const [method, setMethod] = useState<LoginMethod>("username");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function changeMethod(nextMethod: LoginMethod) {
    setMethod(nextMethod);
    setIdentifier("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const callbacks = {
      onSuccess: () => {
        router.push(returnPath());
        router.refresh();
      },
      onError: () => {
        setMessage("Sign-in unsuccessful. Check your details or try again.");
        setLoading(false);
      },
    };

    try {
      if (method === "username") {
        await authClient.signIn.username({
          username: identifier.trim(),
          password,
          rememberMe: true,
        }, callbacks);
        return;
      }

      const validation = indianPhoneSchema.safeParse(identifier);
      if (!validation.success) {
        setMessage("Enter a valid 10-digit Indian mobile number.");
        setLoading(false);
        return;
      }

      await authClient.signIn.phoneNumber({
        phoneNumber: normalizeIndianPhone(identifier),
        password,
        rememberMe: true,
      }, callbacks);
    } catch {
      setMessage("Sign-in is temporarily unavailable. Please try again.");
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setMessage("");
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: returnPath(),
      });
    } catch {
      setMessage("Google sign-in is temporarily unavailable. Please try again.");
      setGoogleLoading(false);
    }
  }

  return (
    <main className="auth-page">
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
          <p className="auth-card-intro">Use your username or verified phone number.</p>

          <div className="auth-methods" aria-label="Choose sign-in method">
            <button type="button" aria-pressed={method === "username"} onClick={() => changeMethod("username")}>Username</button>
            <button type="button" aria-pressed={method === "phone"} onClick={() => changeMethod("phone")}>Phone</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              {method === "username" ? "Username" : "Phone number"}
              <input
                type={method === "phone" ? "tel" : "text"}
                inputMode={method === "phone" ? "tel" : "text"}
                autoComplete={method === "phone" ? "tel" : "username"}
                placeholder={method === "phone" ? "+91 98765 43210" : "Your username"}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
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
