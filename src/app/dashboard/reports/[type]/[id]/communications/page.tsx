import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import ReportCommunications from "@/components/reports/ReportCommunications";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function ReportCommunicationsPage({ params, searchParams }: { params: Promise<{ type: string; id: string }>; searchParams?: Promise<{ thread?: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user || user.status === "BANNED" || user.status === "DELETED") redirect("/login");
  const { type, id } = await params;
  const kind = type.toLowerCase();
  if (kind !== "lost" && kind !== "found") notFound();
  const threadId = (await searchParams)?.thread;
  const moderator = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "REVOK_STEWARD";
  const where = { id, deletedAt: null, ...(moderator ? {} : { OR: [{ status: "ACTIVE" as const, moderation: "APPROVED" as const }, { userId: user.id }] }) };
  let report = kind === "lost" ? await prisma.lostItem.findFirst({ where, select: { id: true, title: true, userId: true } }) : await prisma.foundItem.findFirst({ where, select: { id: true, title: true, userId: true } });
  if (!report && threadId) {
    const hiddenReport = kind === "lost" ? await prisma.lostItem.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, userId: true } }) : await prisma.foundItem.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, userId: true } });
    const ownThread = hiddenReport ? await prisma.reportMessage.findFirst({ where: { id: threadId, parentMessageId: null, senderId: user.id, reportOwnerId: hiddenReport.userId, ...(kind === "lost" ? { lostItemId: id } : { foundItemId: id }) }, select: { id: true } }) : null;
    if (ownThread) report = hiddenReport;
  }
  if (!report) notFound();
  const owner = report.userId === user.id;
  if (!owner && !moderator) {
    if (!threadId) notFound();
    const ownThread = await prisma.reportMessage.findFirst({ where: { id: threadId, parentMessageId: null, senderId: user.id, ...(kind === "lost" ? { lostItemId: id } : { foundItemId: id }) }, select: { id: true } });
    if (!ownThread) notFound();
  }
  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width report-communications-page">
    <Link href={`/dashboard?view=${kind}`} className="button button-outline">Back to reports</Link>
    <p className="eyebrow">Private {kind === "lost" ? "lost" : "found"} report hints</p><h1 className="page-title">{report.title}</h1>
    <p className="page-intro">Hints stay private to this report conversation and do not create or decide a claim.</p>
    <ReportCommunications type={kind} id={id} threadId={threadId} />
  </main><SiteFooter /></div>;
}
