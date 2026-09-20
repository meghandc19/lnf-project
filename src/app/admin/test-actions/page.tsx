"use client";

import { useState } from "react";

export default function TestAdminActions() {
  const [message, setMessage] = useState("");

  async function restrictZoro() {
    const response = await fetch(
      "/api/admin/users/TnTTVUerHUpX425JqzXRWPfBCWU5UwWn",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "DELETE",
          reason: "Test account created for LnF development",
        }),
      },
    );

    const data = await response.json();

    setMessage(JSON.stringify(data));
  }

  return (
    <main>
      <h1>Admin Test</h1>

      <button onClick={restrictZoro}>
        Delete bbbbbb
      </button>

      <p>{message}</p>
    </main>
  );
}