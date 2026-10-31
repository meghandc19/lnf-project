import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/guards";
import GoogleAccountSetup from "@/components/auth/GoogleAccountSetup";

export default async function CompleteGoogleSignupPage() {
  let user;
  try {
    user = await requireActiveUser();
  } catch {
    redirect("/register");
  }

  if (user.phoneNumberVerified && user.username) redirect("/");

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link href="/" className="brand"><Image src="/img/revok-logo.png" width={52} height={52} alt="" className="brand-logo" /><span>REVOK</span></Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">Finish setting up</p>
          <h1>Make it yours.</h1>
          <p>Choose your permanent username, then verify a phone number to prepare your account for protected community actions.</p>
        </div>
        <p className="auth-aside-note">Your number is used for account verification.</p>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">Finish setting up</p>
          <h2>Complete your account</h2>
          <p className="auth-card-intro">Your Google account is connected as {user.email}. Choose a permanent username, then verify your phone.</p>
          <GoogleAccountSetup initialUsername={user.username ?? ""} initialPhone={user.phoneNumber ?? ""} phoneVerified={user.phoneNumberVerified} />
        </div>
      </section>
    </main>
  );
}
