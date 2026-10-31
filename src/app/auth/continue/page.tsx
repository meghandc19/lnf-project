import { redirect } from "next/navigation";
import { requireCanBrowse } from "@/lib/auth/guards";

export default async function SignInContinuePage() {
  const user = await requireCanBrowse().catch(() => null);
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/admin" : "/");
}
