import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import { ReportEditForm } from "@/components/reports/ReportManagement";
import { requireActiveUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { reportOwnerWhere } from "@/lib/items/report-validation";

export default async function EditReportPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  let user;
  try { user = await requireActiveUser(); } catch { redirect("/login"); }
  if (!user.phoneNumberVerified) redirect("/register/complete");
  const { type: rawType, id } = await params;
  const type = rawType.toUpperCase();
  if (type !== "LOST" && type !== "FOUND") notFound();
  const where = reportOwnerWhere(id, user.id);
  const select = { id: true, title: true, description: true, location: true, subcategory: true, brand: true, model: true, color: true, material: true, identifyingMarks: true, privateDetails: true, approximateTime: true, locationDetails: true } as const;
  const report = type === "LOST" ? await prisma.lostItem.findFirst({ where, select: { ...select, lostAt: true, category: { select: { name: true } }, contactedAbout: true } }) : await prisma.foundItem.findFirst({ where, select: { ...select, foundAt: true, category: { select: { name: true } }, custodyStatus: true } });
  if (!report) notFound();
  const reportFields = { ...report, category: report.category.name, occurredAt: ("lostAt" in report ? report.lostAt : report.foundAt).toISOString() };
  return <div className="site-page"><SiteHeader /><main className="subpage-main page-width"><Link href="/dashboard" className="button button-outline">← My reports</Link><p className="eyebrow">Edit {type.toLowerCase()} report</p><h1 className="page-title">Update report details</h1><section className="report-card"><ReportEditForm id={id} type={type} report={reportFields} /></section></main></div>;
}
