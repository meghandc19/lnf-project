# Architecture

## Runtime

The application uses the Next.js App Router under `src/app`. Route handlers implement JSON APIs; server components protect authenticated pages. PostgreSQL is accessed through Prisma 7 and the Better Auth Prisma adapter.

```text
Browser
  ├─ Better Auth client ── /api/auth/[...all] ── Better Auth ── Prisma/PostgreSQL
  ├─ account pages ─────── /api/account/* ───── auth guards ─── Prisma/PostgreSQL
  └─ admin pages ───────── /api/admin/* ─────── admin guard ─── Prisma/PostgreSQL
```

## Authentication

`src/lib/auth/auth.ts` configures Better Auth, Google OAuth when credentials are present, username/password sign-in, username plugin, and phone-number/password and OTP plugin. `src/app/api/auth/[...all]/route.ts` exports the Better Auth GET and POST handlers. The browser auth client uses the current page origin so local LAN phone testing does not send requests to the phone's own `localhost`.

Sessions are resolved from request headers by `src/lib/auth/guards.ts`. The guards load the user record from PostgreSQL so role and status decisions use current database values rather than relying only on the session snapshot.

The signup UI offers phone OTP signup or Google OAuth. Google signup returns to `/register/complete`; that active-session page uses the existing rate-limited account phone OTP endpoints and does not let the account continue past phone verification until the phone is verified. The phone signup flow remains available. Sign-in retains username/password, phone/password, and Google OAuth.

The phone OTP plugin delegates delivery to the modular callback in `src/lib/auth/sms.ts`. In local development only, with `REVOK_DEV_OTP_TERMINAL=true`, it writes Better Auth's generated OTP to the development terminal and masks the phone to its last four digits. The module throws during startup if this flag is enabled outside development. When disabled, delivery fails closed. No SMS request is made; a future provider adapter can replace this callback.

## Authorization and account status

- `requireLogin` allows `ACTIVE` and `RESTRICTED`, and rejects `BANNED` and `DELETED`.
- `requireCanBrowse` uses that same access policy.
- `requireActiveUser` is required for sensitive account changes and `requirePhoneVerified` adds verified-phone enforcement.
- `requireAdmin` additionally requires an active `ADMIN` or `SUPER_ADMIN` account.
- Better Auth's session-create database hook refuses session creation for banned/deleted users; the admin BAN action also deletes that user's existing sessions.
- Admin page authorization in `src/lib/auth/authorization.ts` delegates to the shared server guard. Admin APIs call the same guard directly.
- Public pages remain public. Protected pages and APIs reject banned/deleted users, and the auth layer refuses new sessions for them.

`src/lib/auth/access.ts` captures the intended role-independent status policy for feature code: restricted accounts can browse, while report creation, messaging, claims, and phone changes require an active account; report creation, messaging, and claims also require phone verification.

## Rate limiting

Better Auth's limiter is enabled with in-memory storage and explicit path rules in `auth.ts`: 5 username sign-ins per minute, 5 phone/password sign-ins per minute, 3 Better Auth OTP sends per hour, and 5 OTP verifications per 15 minutes. Better Auth's default limiter also remains enabled for other auth paths.

`src/lib/security/rate-limit.ts` provides fixed-window limits for custom account routes. It hashes user/phone identifiers before using them as in-memory keys. The custom limits are 3 phone OTP sends per phone number and 5 per user per hour; 5 verification attempts per phone number and 20 per user per 15 minutes; and 5 account setup attempts per user per hour.

Both limiters are process-local. They reset on restart, can be bypassed by distributing traffic across instances, and require shared storage (such as Redis) before a multi-instance production deployment. IP identification and proxy trust have not been separately configured or verified.

## Trusted origins and configuration

Local development retains `http://localhost:3000` as a trusted origin. When `BETTER_AUTH_URL` is a valid URL, its origin is added; no production hostname is assumed. `REVOK_LOCAL_NETWORK_ORIGIN` can add one HTTP private/local origin while `NODE_ENV=development`, to support same-Wi-Fi phone testing; public origins and production use are rejected by this configuration. Required variables are `DATABASE_URL` and `BETTER_AUTH_URL`; Google OAuth additionally uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `REVOK_DEV_OTP_TERMINAL` must only be set to `true` for local development. No SMS provider is configured in this phase.

## Database model

`prisma/schema.prisma` contains Better Auth models and user role/status fields, a nullable 280-character `User.about` profile field, plus planned categories, lost/found items, images, matches, claims, chat, notifications, moderation, audit logs, and deletion records. Migration `20261025090000_add_user_about` adds the profile field. The existence of item models does not mean corresponding product APIs or workflows are implemented.

## Profile

`PATCH /api/account/profile` requires an active account and is rate-limited per user. Zod bounds the display name, about text, and photo URL. Photo references are HTTPS or same-site paths; there is no upload/storage service. The server-rendered header calls the shared account-status guard and displays profile/dashboard navigation only for a currently permitted session.
