import { redirect } from "next/navigation";
import { requireAdmin as requireAdminUser } from "@/lib/auth/guards";

export async function requireAdmin() {
  try {
    return await requireAdminUser();
  } catch {
    redirect("/login");
  }
}
