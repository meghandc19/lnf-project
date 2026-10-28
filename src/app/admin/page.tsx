import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/auth/LogoutButton";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [totalUsers, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="admin-main page-width">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">REVOK administration</p>
            <h1>Welcome, {admin.name}.</h1>
            <p>Account access and current user records.</p>
          </div>
          <div className="admin-heading-actions"><span className="status-chip">{admin.role.replace("_", " ")}</span><LogoutButton /></div>
        </div>

        <section className="admin-summary" aria-label="Account totals">
          <p className="eyebrow">Registered accounts</p>
          <strong>{totalUsers}</strong>
          <span>Current total from the database</span>
        </section>

        <div className="admin-section-heading">
          <div><h2>Recent accounts</h2><p>Latest 50 user records. Contact details are omitted.</p></div>
          <Link href="/admin/reports" className="button button-primary">Review item reports</Link>
          <Link href="/dashboard" className="text-link">Your dashboard <span aria-hidden="true">→</span></Link>
        </div>
        <div className="admin-table-wrap">
          {users.length === 0 ? (
            <p className="admin-empty">No user records are available.</p>
          ) : (
            <table className="admin-table">
              <caption className="visually-hidden">Latest REVOK user accounts</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead>
              <tbody>{users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td><td>{user.username ? `@${user.username}` : "—"}</td><td>{user.role.replace("_", " ")}</td><td><span className={`table-status status-${user.status.toLowerCase()}`}>{user.status}</span></td><td>{dateFormatter.format(user.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <p className="admin-note">Item report review is available only to active administrators.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
