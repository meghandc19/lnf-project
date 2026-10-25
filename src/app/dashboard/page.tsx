import { redirect } from "next/navigation";
import { requireCanBrowse } from "@/lib/auth/guards";
import LogoutButton from "@/components/auth/LogoutButton";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Image from "next/image";

export default async function DashboardPage() {
  let user;
  try {
    user = await requireCanBrowse();
  } catch {
    redirect("/login");
  }
  const [lostCount, foundCount] = await Promise.all([
    prisma.lostItem.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.foundItem.count({ where: { userId: user.id, deletedAt: null } }),
  ]);
  const memberMonths = Math.max(1, (new Date().getFullYear() - user.createdAt.getFullYear()) * 12 + new Date().getMonth() - user.createdAt.getMonth());

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="dashboard-main page-width">
        <div className="dashboard-welcome">
          <div>
            <p className="eyebrow">Your REVOK space</p>
            <h1>Welcome, {user.name}.</h1>
          <p>Your account overview and community history.</p>
          </div>
          <div className="dashboard-heading-actions"><Link href="/profile" className="button button-outline">Edit profile</Link><LogoutButton /></div>
        </div>
        {user.status === "RESTRICTED" && (
          <div className="notice-card" role="status">
            <strong>Browsing access</strong>
            <p>Your account is restricted. You can browse available information, but protected actions are disabled.</p>
          </div>
        )}
        <section className="account-summary" aria-label="Account details">
          {user.image ? <Image className="account-avatar account-avatar-image" src={user.image} width={42} height={42} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>}
          <div><strong>{user.name}</strong><span>{user.username ? `@${user.username}` : "Username not set"}</span></div>
          <span className="status-chip">{user.status === "ACTIVE" ? "Active" : "Restricted"}</span>
        </section>
        <section className="dashboard-stats" aria-label="Community history">
          <article><span>Lost reports</span><strong>{lostCount}</strong><small>created by you</small></article>
          <article><span>Found reports</span><strong>{foundCount}</strong><small>created by you</small></article>
          <article><span>Member for</span><strong>{memberMonths}</strong><small>{memberMonths === 1 ? "month" : "months"}</small></article>
        </section>
        <div className="dashboard-history-note"><strong>Helping return items</strong><p>Completed handovers and items you helped reunite will appear here when reporting and claim features are connected. No history is being estimated.</p></div>
        <div className="dashboard-grid">
          {[
            ["Your reports", "Item report management is not available yet."],
            ["Potential matches", "Matching is not available until item reports are connected."],
            ["Claims", "Claim and handover workflows are still in development."],
            ["Notifications", "There are no notification features connected yet."],
          ].map(([title, description]) => (
            <article className="dashboard-card" key={title}>
              <h2>{title}</h2>
              <p>{description}</p>
              <span className="status-chip">Coming later</span>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
