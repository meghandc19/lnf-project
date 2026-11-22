import { redirect } from "next/navigation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import ProfileEditor from "@/components/profile/ProfileEditor";
import GoogleAccountSetup from "@/components/auth/GoogleAccountSetup";
import { requireCanBrowse } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import styles from "../dashboard/AccountPages.module.css";

export default async function ProfilePage() {
  let user;
  try {
    user = await requireCanBrowse();
  } catch {
    redirect("/login?callbackURL=/profile");
  }
  const [inventory, googleAccount, credentialAccount] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, brand: true, color: true } }),
    prisma.account.findFirst({ where: { userId: user.id, providerId: "google" }, select: { id: true } }),
    prisma.account.findFirst({ where: { userId: user.id, providerId: "credential", password: { not: null } }, select: { id: true } }),
  ]);

  return (
    <div className="site-page">
      <SiteHeader />
      <main className={`profile-main page-width ${styles.profilePage}`}>
        <p className="eyebrow">Your REVOK identity</p>
        <h1 className="page-title">A little about you.</h1>
        <p className="page-intro">Your profile helps people recognize you in the community. Keep personal details private.</p>
        {user.status === "RESTRICTED" && <div className="notice-card" role="status"><strong>Profile editing is paused</strong><p>Restricted accounts can browse but cannot change protected account details.</p></div>}
        {googleAccount && !user.username && user.status === "ACTIVE" && <section className="profile-card" aria-labelledby="account-setup-heading"><p className="eyebrow">Account setup</p><h2 id="account-setup-heading">Choose your REVOK username</h2><p className="auth-help">Your Google account already works. Add a permanent username here, and verify a phone whenever you&apos;re ready to participate.</p><GoogleAccountSetup initialUsername="" initialPhone={user.phoneNumber ?? ""} phoneVerified={user.phoneNumberVerified} /></section>}
        <ProfileEditor
          user={{ name: user.name, username: user.username, about: user.about, image: user.image, phoneNumber: user.phoneNumber, phoneNumberVerified: user.phoneNumberVerified }}
          inventory={inventory}
          canEdit={user.status === "ACTIVE"}
          hasGoogleAuth={Boolean(googleAccount)}
          hasPassword={Boolean(credentialAccount)}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
