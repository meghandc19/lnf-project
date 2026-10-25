import { requireAdmin } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

export default async function TestAdminActions() {
  await requireAdmin();
  redirect("/admin");
}
