import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/guards";
import GooglePhoneVerification from "@/components/auth/GooglePhoneVerification";

export default async function CompleteGoogleSignupPage() {
  let user;
  try {
    user = await requireActiveUser();
  } catch {
    redirect("/register");
  }

  if (user.phoneNumberVerified) redirect("/");

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link href="/" className="brand"><Image src="/img/revok-logo.png" width={52} height={52} alt="" className="brand-logo" /><span>REVOK</span></Link>
        <div className="auth-aside-copy">
          <p className="eyebrow">One more step</p>
          <h1>Verify your phone.</h1>
          <p>Google sign-up is complete. Verify a phone number so your REVOK account can use protected community actions.</p>
        </div>
        <p className="auth-aside-note">Your number is used for account verification.</p>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">Finish setting up</p>
          <h2>Verify your phone</h2>
          <p className="auth-card-intro">Your Google account is connected as {user.email}. Enter a mobile number to receive a local development OTP.</p>
          <GooglePhoneVerification initialPhone={user.phoneNumber ?? ""} />
        </div>
      </section>
    </main>
  );
}
