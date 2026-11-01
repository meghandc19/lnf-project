import { redirect } from "next/navigation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import ProfileEditor from "@/components/profile/ProfileEditor";
import { requireCanBrowse } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  let user;
  try {
    user = await requireCanBrowse();
  } catch {
    redirect("/login?callbackURL=/profile");
  }
  const inventory = await prisma.inventoryItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, brand: true, color: true } });

  return (
    <div className="site-page">
      <SiteHeader />
      <main className="profile-main page-width">
        <p className="eyebrow">Your REVOK identity</p>
        <h1 className="page-title">A little about you.</h1>
        <p className="page-intro">Your profile helps people recognize you in the community. Keep personal details private.</p>
        {user.status === "RESTRICTED" && <div className="notice-card" role="status"><strong>Profile editing is paused</strong><p>Restricted accounts can browse but cannot change protected account details.</p></div>}
        <ProfileEditor user={{ name: user.name, username: user.username, about: user.about, image: user.image, phoneNumber: user.phoneNumber, phoneNumberVerified: user.phoneNumberVerified }} inventory={inventory} canEdit={user.status === "ACTIVE"} />
      </main>
      <SiteFooter />
    </div>
  );
}
