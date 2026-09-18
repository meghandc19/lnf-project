import { requireAdmin } from "@/lib/auth/authorization";

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <main>
      <h1>LnF Admin Dashboard</h1>
      <p>Welcome, {user.name}</p>
      <p>Role: {user.role}</p>
    </main>
  );
}