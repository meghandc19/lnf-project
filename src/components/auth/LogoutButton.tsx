"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await authClient.signOut();
      router.replace("/login");
    } catch {
      setLoading(false);
    }
  }

  return <button className="logout-button" onClick={handleLogout} disabled={loading} aria-busy={loading}>{loading ? "Logging out…" : "Log out"}</button>;
}
