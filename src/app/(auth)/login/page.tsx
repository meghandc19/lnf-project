"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

type LoginMethod = "username" | "email" | "phone";

export default function LoginPage() {
  const [method, setMethod] = useState<LoginMethod>("username");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    if (method === "username") {
      await authClient.signIn.username(
        {
          username: identifier,
          password,
        },
        {
          onSuccess: () => {
            setMessage("Login successful.");
            setLoading(false);
          },
          onError: (ctx) => {
            setMessage(ctx.error.message);
            setLoading(false);
          },
        },
      );
    }

    if (method === "email") {
      await authClient.signIn.email(
        {
          email: identifier,
          password,
        },
        {
          onSuccess: () => {
            setMessage("Login successful.");
            setLoading(false);
          },
          onError: (ctx) => {
            setMessage(ctx.error.message);
            setLoading(false);
          },
        },
      );
    }

    if (method === "phone") {
      await authClient.signIn.phoneNumber(
        {
          phoneNumber: identifier,
          password,
        },
        {
          onSuccess: () => {
            setMessage("Login successful.");
            setLoading(false);
          },
          onError: (ctx) => {
            setMessage(ctx.error.message);
            setLoading(false);
          },
        },
      );
    }
  }

  return (
    <main>
      <h1>Login to LnF</h1>

      <div>
        <button type="button" onClick={() => setMethod("username")}>
          Username
        </button>

        <button type="button" onClick={() => setMethod("email")}>
          Email
        </button>

        <button type="button" onClick={() => setMethod("phone")}>
          Phone
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          placeholder={
            method === "username"
              ? "Username"
              : method === "email"
                ? "Email"
                : "Phone number"
          }
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  );
}