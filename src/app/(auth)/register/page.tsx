"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setMessage("");
  setLoading(true);

  await authClient.signUp.email(
    {
      name,
      username,
      email,
      password,
    },
    {
      onSuccess: () => {
        setMessage("Account created successfully.");
        setLoading(false);
      },
      onError: (ctx) => {
        setMessage(ctx.error.message);
        setLoading(false);
      },
    },
  );
}

  return (
    <main>
      <h1>Create your LnF account</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  );
}