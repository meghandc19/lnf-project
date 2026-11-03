# REVOK — Lost and Found Application

REVOK is a community lost-and-found web application developed for VTU subject 1BCP308. The current repository contains a Next.js App Router application, authentication foundation, account administration routes, and a PostgreSQL/Prisma schema for planned lost-and-found workflows.

## Stack

- Next.js 16.3.5, React 19, TypeScript, Tailwind CSS
- PostgreSQL with Prisma 7
- Better Auth with Google OAuth, username/password, and phone-number support
- Zod validation

## Local development

Install dependencies and configure the environment variables below in `.env`:

- `DATABASE_URL`
- `BETTER_AUTH_URL` (for local development, `http://localhost:3000`)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (needed for Google OAuth)
- MSG91 credentials are required for phone OTP; see `docs/REVOK_1_1_DEPLOYMENT.md`

Do not commit `.env` or paste secret values into logs or documentation. Apply the existing Prisma migrations before starting the app.

```bash
npm install
npx prisma migrate deploy
npm run dev
```

The application is available at `http://localhost:3000`. Phone OTP does not use a local code or bypass: it requires a configured, enabled MSG91 account. Missing credentials leave phone verification unavailable and do not verify accounts.

### View the local site on a phone

Keep the development server running on your computer, connected to the same Wi-Fi as your phone. In PowerShell, start Next.js on the local network:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Find the computer's private IPv4 address with `ipconfig`, then open `http://<computer-ip>:3000` on the phone (for example, `http://192.168.1.20:3000`). If Windows Firewall asks, allow access on the private network. For phone-based username/password and OTP auth, set `REVOK_LOCAL_NETWORK_ORIGIN` in `.env` to that exact local origin and restart the server; only private/local origins are accepted, and only while `NODE_ENV=development`. The auth client uses the page's current origin. Google OAuth callbacks still depend on `BETTER_AUTH_URL` and Google callback configuration, so phone OAuth may need a matching callback registered separately.

Responsive layouts use CSS breakpoints and a mobile-first home page. Profile and item photos use validated image uploads; phone changes require OTP verification. Production uploads, including profile photos, require the configured S3-compatible object store. See the deployment guide for the production setup.

For a production deployment, configure `UPLOAD_STORAGE=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Set `S3_ENDPOINT` for an S3-compatible provider with a custom endpoint. Never commit these values. A real bucket, IAM policy, MSG91 delivery, and deployment have not been tested in this repository.

## Available checks

```bash
npm run lint
npm run test:security
npm run test:items
npx tsc --noEmit
npm run build
```

## Authentication notes

Better Auth handles sessions and Google, username/password, and phone-number authentication. Signup offers Google OAuth or phone OTP plus username/password. New Google accounts choose an available permanent username at `/register/complete`, then verify a phone before protected account actions are available. Phone signup chooses an available permanent username after phone verification. MSG91 sends and authoritatively verifies OTPs through the existing Better Auth plugin callback. No local OTP bypass is available.

Better Auth uses its database-backed rate-limit table in production. Custom route limits still use process-local storage and need a shared store before relying on them across serverless instances. Proxy/IP trust has not been independently verified.

See `docs/PROJECT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/API_STATUS.md`, and `docs/DEVELOPMENT_ROADMAP.md` for verified implementation status and known gaps.

## Admin access

Admin roles are stored in PostgreSQL and checked server-side. Configure `REVOK_SUPER_ADMIN_EMAIL` with the dedicated Gmail address in the local ignored `.env.local`/`.env` file or deployment environment. When that existing active account with a verified email and linked Google provider signs in, Better Auth promotes it to Super Admin in a one-time audited transaction; this also reconciles a different prior bootstrap owner. Later ownership changes use the explicit Super Admin transfer flow. The operator command `npm run admin:bootstrap-super-admin` remains available for initial provisioning before a sign-in. No schema migration is required. After sign-in, Admin and Super Admin accounts are sent to `/admin` by default.

Super Admins can appoint eligible active, verified users as Admins, remove Admin roles, and transfer ownership to an existing eligible Admin after typing an explicit phrase and re-entering their signed-in email. Ordinary Admins can moderate normal users and reports but cannot change Admin or Super Admin accounts. Admin-only user details show verified phone linkage and lost/found report status summaries; private verification details remain hidden. Both admin tiers can see recent account/report counts; audit events and role-management controls are Super Admin only. The admin dashboard currently covers accounts and report review; claims, chat, community settings, and broader security-event monitoring are not implemented.

Custom admin-operation rate limits use in-memory storage and need a shared store for consistent enforcement across serverless instances. Better Auth auth-endpoint limits use PostgreSQL in production. Coordinate the one-time bootstrap command against the production database before operating multiple application instances. `/admin/security` provides a server-side configuration checklist without exposing secrets.
