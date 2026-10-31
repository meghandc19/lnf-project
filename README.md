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
- `REVOK_DEV_OTP_TERMINAL=true` only for local development OTP testing

Do not commit `.env` or paste secret values into logs or documentation. Apply the existing Prisma migrations before starting the app.

```bash
npm install
npx prisma migrate deploy
npm run dev
```

In PowerShell, opt in to local terminal OTPs for that development-server process with:

```powershell
$env:REVOK_DEV_OTP_TERMINAL = "true"
npm run dev
```

The application is available at `http://localhost:3000`. The opt-in is rejected outside `NODE_ENV=development`; never set it for `npm run build` or `npm start`. When disabled, phone OTP delivery fails closed. The development callback logs the actual generated code with only the last four phone digits masked and sends no SMS.

### View the local site on a phone

Keep the development server running on your computer, connected to the same Wi-Fi as your phone. In PowerShell, start Next.js on the local network:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Find the computer's private IPv4 address with `ipconfig`, then open `http://<computer-ip>:3000` on the phone (for example, `http://192.168.1.20:3000`). If Windows Firewall asks, allow access on the private network. For phone-based username/password and OTP auth, set `REVOK_LOCAL_NETWORK_ORIGIN` in `.env` to that exact local origin and restart the server; only private/local origins are accepted, and only while `NODE_ENV=development`. The auth client uses the page's current origin. Google OAuth callbacks still depend on `BETTER_AUTH_URL` and Google callback configuration, so phone OAuth may need a matching callback registered separately.

Responsive layouts use CSS breakpoints and a mobile-first home page. The profile editor saves display name and a 280-character about field. JPEG/PNG/WebP profile photos can be selected or dragged and dropped, including small images, up to 8 MB; profile photos are public. Verified phone numbers can be changed only after an OTP is verified for the new number. Lost/found reports require an active account with a verified phone and save item identification, category/subcategory, date/time, location details, private owner-only verification details, and up to three JPEG/PNG/WebP photos (5 MB each). Reports persist in PostgreSQL and remain connected to the owner dashboard. Owners can view, edit, resolve/reopen, and soft-delete their own reports. Edits return to pending review. Active admins can review pending/flagged reports at `/admin/reports`; public search only displays active approved reports, and public details omit private verification information. Image metadata is retained; remove GPS/location data and cover personal information in ID photos before uploading. Local item uploads use ignored `.data/uploads`. Production requires an S3-compatible object store; profile photos remain local and need a separate production storage solution.

For a production deployment, configure `UPLOAD_STORAGE=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Set `S3_ENDPOINT` for an S3-compatible provider with a custom endpoint. Never commit these values. Production intentionally rejects local filesystem item storage. A real bucket, IAM policy, and deployment have not been tested in this repository.

## Available checks

```bash
npm run lint
npm run test:security
npm run test:items
npx tsc --noEmit
npm run build
```

## Authentication notes

Better Auth handles sessions and the Google, username/password, and phone-number authentication endpoints. Signup offers Google OAuth or phone OTP plus username/password. New Google accounts choose an available permanent username at `/register/complete`, then verify a phone before protected account actions are available. Phone signup chooses an available permanent username after phone verification. Sign-in offers username/password and Google (with phone/password retained). Local terminal OTP delivery is opt-in, development-only, and uses Better Auth's generated OTP, expiration, and attempt controls. No SMS provider is called. A future SMS adapter can replace the modular delivery callback after deployment configuration.

Rate limits currently use in-memory storage. They are suitable for local development and a single process, but do not coordinate across server instances or survive restarts. Production deployment needs shared rate-limit storage and verified proxy/IP configuration.

See `docs/PROJECT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/API_STATUS.md`, and `docs/DEVELOPMENT_ROADMAP.md` for verified implementation status and known gaps.

## Admin access

Admin roles are stored in PostgreSQL and checked server-side. Configure `REVOK_SUPER_ADMIN_EMAIL` with the dedicated Gmail address in the local ignored `.env.local`/`.env` file or deployment environment. When that existing active account with a verified email and linked Google provider signs in, Better Auth promotes it to Super Admin in a one-time audited transaction; this also reconciles a different prior bootstrap owner. Later ownership changes use the explicit Super Admin transfer flow. The operator command `npm run admin:bootstrap-super-admin` remains available for initial provisioning before a sign-in. No schema migration is required. After sign-in, Admin and Super Admin accounts are sent to `/admin` by default.

Super Admins can appoint eligible active, verified users as Admins, remove Admin roles, and transfer ownership to an existing eligible Admin after typing an explicit phrase and re-entering their signed-in email. Ordinary Admins can moderate normal users and reports but cannot change Admin or Super Admin accounts. Admin-only user details show verified phone linkage and lost/found report status summaries; private verification details remain hidden. Both admin tiers can see recent account/report counts; audit events and role-management controls are Super Admin only. The admin dashboard currently covers accounts and report review; claims, chat, community settings, and broader security-event monitoring are not implemented.

Bootstrap and custom admin-operation rate limits use in-memory storage. They are appropriate for local development and a single server process; use shared rate-limit storage and coordinate the bootstrap command against the production database before operating multiple application instances.
