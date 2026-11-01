import { redirect } from "next/navigation";
import ClaimConversation from "@/components/claims/ClaimConversation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { requireCanBrowse } from "@/lib/auth/guards";

export default async function ClaimPage({ params }: { params: Promise<{ claimId: string }> }) {
  let user;
  try { user = await requireCanBrowse(); } catch { redirect("/login"); }
  const { claimId } = await params;
  return <div className="site-page"><SiteHeader /><ClaimConversation claimId={claimId} viewerId={user.id} /><SiteFooter /></div>;
}
