"use client";

import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  async function handleLogout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return <button onClick={handleLogout}>Logout</button>;
}