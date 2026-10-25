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

Responsive layouts use CSS breakpoints. The profile editor saves display name, a 280-character about field, and an HTTPS or same-site photo URL. It does not upload image files. The dashboard shows actual lost/found record counts and account age; completed handovers and item history remain unavailable until those backend workflows exist.

## Available checks

```bash
npm run lint
npm run test:security
npx tsc --noEmit
npm run build
```

## Authentication notes

Better Auth handles sessions and the Google, username/password, and phone-number authentication endpoints. Signup offers Google OAuth or phone OTP plus username/password. Google signup returns to /register/complete, where phone verification is required before protected account actions are available. Sign-in offers username/password and Google (with phone/password retained). Local terminal OTP delivery is opt-in, development-only, and uses Better Auth's generated OTP, expiration, and attempt controls. No SMS provider is called. A future SMS adapter can replace the modular delivery callback after deployment configuration.

Rate limits currently use in-memory storage. They are suitable for local development and a single process, but do not coordinate across server instances or survive restarts. Production deployment needs shared rate-limit storage and verified proxy/IP configuration.

See `docs/PROJECT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/API_STATUS.md`, and `docs/DEVELOPMENT_ROADMAP.md` for verified implementation status and known gaps.
