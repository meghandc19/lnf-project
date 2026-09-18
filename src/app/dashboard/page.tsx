import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>LnF Dashboard</h1>
      <p>Welcome, {user.name}!</p>
      <p>Username: {user.username}</p>

      <LogoutButton />
    </main>
  );
}