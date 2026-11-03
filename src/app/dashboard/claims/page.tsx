import { redirect } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ConversationList, { type ConversationEntry } from "@/components/claims/ConversationList";
import { requireCanBrowse } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

type View = "sent" | "received";
export default async function DashboardClaimsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  let user;
  try { user = await requireCanBrowse(); } catch { redirect("/login"); }
  const requestedView = (await searchParams).view;
  const view: View = requestedView === "received" ? "received" : "sent";
  const activeParticipation = { is: { participants: { some: { userId: user.id, deletedAt: null } } } };
  // Keep both views mutually exclusive even if historical data contains a self-claim.
  const sentWhere = { userId: user.id, foundItemId: { not: null }, foundItem: { userId: { not: user.id } }, conversation: activeParticipation };
  const receivedWhere = { foundItem: { userId: user.id }, userId: { not: user.id }, conversation: activeParticipation };

  const rows = view === "sent"
    ? await prisma.claim.findMany({ where: sentWhere, orderBy: { updatedAt: "desc" }, take: 100, include: { foundItem: { select: { id: true, title: true, location: true, custodyStatus: true, images: { take: 1, select: { url: true } }, user: { select: { name: true, username: true, image: true } } } }, conversation: { include: { messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true, senderId: true } }, participants: { where: { userId: user.id, deletedAt: null }, select: { lastReadAt: true } } } } } })
    : await prisma.claim.findMany({ where: receivedWhere, orderBy: { updatedAt: "desc" }, take: 100, include: { user: { select: { name: true, username: true, image: true } }, foundItem: { select: { id: true, title: true, location: true, custodyStatus: true, images: { take: 1, select: { url: true } } } }, conversation: { include: { messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true, senderId: true } }, participants: { where: { userId: user.id, deletedAt: null }, select: { lastReadAt: true } } } } } });

  const conversations: ConversationEntry[] = rows.flatMap((claim) => {
    if (!claim.foundItem || !claim.conversation) return [];
    const other = view === "sent" && "user" in claim.foundItem ? claim.foundItem.user : "user" in claim ? claim.user : null;
    if (!other) return [];
    const lastMessage = claim.conversation.messages[0];
    const lastReadAt = claim.conversation.participants[0]?.lastReadAt ?? null;
    return [{ id: claim.id, status: claim.status, createdAt: claim.createdAt.toISOString(), item: { id: claim.foundItem.id, title: claim.foundItem.title, location: claim.foundItem.location, custodyStatus: claim.foundItem.custodyStatus, image: claim.foundItem.images[0]?.url ?? null }, other, lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt.toISOString(), senderId: lastMessage.senderId } : null, lastReadAt: lastReadAt?.toISOString() ?? null, viewerId: user.id }];
  });

  return <div className="site-page"><SiteHeader /><main className="dashboard-main page-width claims-hub-page">
    <Link className="button button-outline" href="/dashboard/claims">← Claim requests</Link><p className="eyebrow">{view === "sent" ? "My Claims" : "Claim Requests Received"}</p><h1 className="page-title">{view === "sent" ? "My Claims" : "Claim Requests Received"}</h1>
    <nav className="claim-list-switch" aria-label="Claim conversation lists"><Link className={view === "sent" ? "is-current" : ""} href="/dashboard/claims?view=sent">My Claims</Link><Link className={view === "received" ? "is-current" : ""} href="/dashboard/claims?view=received">Claim Requests Received</Link></nav>
    <ConversationList initialItems={conversations} emptyText={view === "sent" ? "Claim requests you send will appear here." : "No claim requests have been received for your found items yet."} />
  </main><SiteFooter /></div>;
}
