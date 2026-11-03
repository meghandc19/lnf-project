import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getOtpProviderConfig } from "@/lib/auth/sms";

export const dynamic = "force-dynamic";

type Check = { label: string; state: "ready" | "missing" | "unknown"; detail: string };
const enabled = (value: string | undefined) => Boolean(value?.trim());

export default async function AdminSecurityPage() {
  await requireAdmin();
  const otp = getOtpProviderConfig();
  const production = process.env.NODE_ENV === "production";
  let databaseReachable = false;
  let rateLimitTablePresent = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  }
  if (databaseReachable) {
    try {
      const rateLimitTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('"RateLimit"') IS NOT NULL AS exists`;
      rateLimitTablePresent = rateLimitTable[0]?.exists === true;
    } catch { rateLimitTablePresent = false; }
  }
  const authUrl = process.env.BETTER_AUTH_URL;
  let secureProductionUrl = false;
  try { secureProductionUrl = new URL(authUrl ?? "").protocol === "https:"; } catch { /* Invalid or missing URL. */ }
  const s3Configured = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].every((key) => enabled(process.env[key]));
  const checks: Check[] = [
    { label: "Authentication secret", state: enabled(process.env.BETTER_AUTH_SECRET) && (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 ? "ready" : "missing", detail: "Configured server-side; secret value is never displayed." },
    { label: "Public authentication URL", state: authUrl && (!production || secureProductionUrl) ? "ready" : "missing", detail: production ? "Must be an HTTPS production URL." : "Set to the public site origin for deployment." },
    { label: "PostgreSQL connectivity", state: databaseReachable ? "ready" : "missing", detail: databaseReachable ? "A read-only connectivity check succeeded." : "A read-only connectivity check failed." },
    { label: "Persistent Better Auth rate limits", state: !production ? "unknown" : rateLimitTablePresent ? "ready" : "missing", detail: !production ? "Database storage is enabled automatically in production." : rateLimitTablePresent ? "Database-backed RateLimit table is present." : "Apply the included RateLimit migration before production authentication traffic." },
    { label: "Secure production cookies", state: !production ? "unknown" : secureProductionUrl ? "ready" : "missing", detail: "Production Better Auth cookies are configured as Secure; the site must use HTTPS." },
    { label: "Application route rate limits", state: "unknown", detail: "Custom route limits are process-local; use a shared store before relying on them across serverless instances." },
    { label: "Content Security Policy", state: "unknown", detail: "No CSP has been configured or reviewed for all current third-party assets and inline scripts." },
    { label: "Proxy and client IP trust", state: "unknown", detail: "Forwarded client IP handling has not been independently verified for the selected Vercel deployment." },
    { label: "Image object storage", state: production && s3Configured && process.env.UPLOAD_STORAGE === "s3" ? "ready" : production ? "missing" : "unknown", detail: production ? "Production uploads require S3-compatible storage." : "Production storage has not been verified in this environment." },
    { label: "Production runtime", state: production ? "ready" : "unknown", detail: production ? "The application is running with NODE_ENV=production." : "This server is not running in the production environment." },
    { label: "Google sign-in", state: enabled(process.env.GOOGLE_CLIENT_ID) && enabled(process.env.GOOGLE_CLIENT_SECRET) ? "ready" : "unknown", detail: "Optional; configure both Google OAuth credentials if this sign-in method is offered." },
  ];
  const label = (state: Check["state"]) => state === "ready" ? "Configured" : state === "missing" ? "Needs attention" : "Not verified";

  return <div className="site-page"><SiteHeader /><main className="page-width admin-main">
    <Link href="/admin" className="button button-outline">← Admin overview</Link>
    <p className="eyebrow">Production configuration</p><h1>Security &amp; settings</h1>
    <p className="page-intro">Server-side configuration status for REVOK. Secret values are never included on this page.</p>
    <section className="admin-content-panel" aria-labelledby="otp-status"><p className="eyebrow">Phone verification</p><h2 id="otp-status">OTP provider: MSG91</h2>
      <dl className="admin-status-list">
        <div><dt>Configuration</dt><dd>{otp.configured ? "Configured" : "Not configured"}</dd></div>
        <div><dt>OTP delivery</dt><dd>{otp.enabled ? "Enabled" : "Disabled"}</dd></div>
        <div><dt>Template ID</dt><dd>{process.env.MSG91_OTP_TEMPLATE_ID?.trim() ? "Present (value hidden)" : "Missing"}</dd></div>
        <div><dt>OTP length and expiry</dt><dd>{otp.otpLength} digits · {otp.otpExpiryMinutes} minute(s)</dd></div>
        <div><dt>Resend cooldown</dt><dd>60 seconds · maximum 3 sends per hour per phone</dd></div>
        <div><dt>Verification attempts</dt><dd>Up to 3 attempts per issued code; Better Auth limits requests to 5 per 15 minutes</dd></div>
      </dl>
    </section>
    <section className="admin-content-panel" aria-labelledby="environment-status"><p className="eyebrow">Environment checklist</p><h2 id="environment-status">Production checks</h2><div className="admin-review-list">{checks.map((check) => <article key={check.label}><div className="admin-section-heading"><strong>{check.label}</strong><span className={`status-chip ${check.state}`}>{label(check.state)}</span></div><p>{check.detail}</p></article>)}</div></section>
    <section className="admin-content-panel"><p className="eyebrow">MSG91 configuration</p><p>Set <code>MSG91_AUTH_KEY</code>, <code>MSG91_OTP_TEMPLATE_ID</code>, <code>MSG91_OTP_LENGTH</code>, <code>MSG91_OTP_EXPIRY_MINUTES</code>, and <code>MSG91_ENABLED</code> in the hosting environment. Keep the Auth Key private. Configure the template to send the provided OTP value.</p></section>
  </main><SiteFooter /></div>;
}
