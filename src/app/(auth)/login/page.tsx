"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  indianPhoneSchema,
  normalizeIndianPhone,
} from "@/lib/validation/common";

type LoginMethod = "username" | "phone";

export default function LoginPage() {
  const [method, setMethod] =
    useState<LoginMethod>("username");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] =
    useState(false);

  function changeMethod(nextMethod: LoginMethod) {
    setMethod(nextMethod);
    setIdentifier("");
    setMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      if (method === "username") {
        await authClient.signIn.username(
          {
            username: identifier.trim(),
            password,
            rememberMe: true,
          },
          {
            onSuccess: () => {
              window.location.href = "/dashboard";
            },
            onError: (ctx) => {
              setMessage(ctx.error.message);
              setLoading(false);
            },
          },
        );
      }

      if (method === "phone") {
        const validation = indianPhoneSchema.safeParse(identifier);

        if (!validation.success) {
          setMessage("Enter a valid 10-digit Indian mobile number.");
          setLoading(false);
          return;
        }

        const normalizedPhone = normalizeIndianPhone(identifier);

        await authClient.signIn.phoneNumber(
          {
            phoneNumber: normalizedPhone,
            password,
            rememberMe: true,
          },
          {
            onSuccess: () => {
              window.location.href = "/dashboard";
            },
            onError: (ctx) => {
              setMessage(ctx.error.message);
              setLoading(false);
            },
          },
        );
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setMessage("");
    setGoogleLoading(true);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setMessage(
        "Google sign-in failed. Please try again.",
      );
      setGoogleLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            Login to REVOK
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Sign in to continue to your account.
          </p>
        </div>

        {/* Login method */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => changeMethod("username")}
            className="rounded-xl border px-3 py-2"
          >
            Username
          </button>

          <button
            type="button"
            onClick={() => changeMethod("phone")}
            className="rounded-xl border px-3 py-2"
          >
            Phone
          </button>
        </div>

        {/* Password login */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder={
              method === "username"
                ? "Username"
                : "Phone number"
            }
            value={identifier}
            onChange={(event) =>
              setIdentifier(event.target.value)
            }
            required
            autoComplete={
              method === "phone"
                ? "tel"
                : "username"
            }
            className="w-full rounded-xl border p-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            minLength={8}
            autoComplete="current-password"
            className="w-full rounded-xl border p-3"
          />

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full rounded-xl border p-3"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="text-sm text-gray-500">
            OR
          </span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Google login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="w-full rounded-xl border p-3"
        >
          {googleLoading
            ? "Connecting to Google..."
            : "Continue with Google"}
        </button>

        {/* Error / status */}
        {message && (
          <p className="rounded-xl border p-3 text-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}