# Architecture

## Runtime

The application uses the Next.js App Router under `src/app`. Route handlers implement JSON APIs; server components protect authenticated pages. PostgreSQL is accessed through Prisma 7 and the Better Auth Prisma adapter. The homepage renders its existing hero directly without mounting a startup intro component or requesting intro video media.

```text
Browser
  ├─ Better Auth client ── /api/auth/[...all] ── Better Auth ── Prisma/PostgreSQL
  ├─ account pages ─────── /api/account/* ───── auth guards ─── Prisma/PostgreSQL
  ├─ item reports ──────── /api/items ───────── auth + phone guard ─ Prisma/PostgreSQL
  │                                               └─ validated private images ─ local .data/uploads
  └─ admin pages ───────── /api/admin/* ─────── admin guard ─── Prisma/PostgreSQL
```

## Authentication

`src/lib/auth/auth.ts` configures Better Auth, Google OAuth when credentials are present, username/password sign-in, username plugin, and phone-number/password and OTP plugin. `src/app/api/auth/[...all]/route.ts` exports the Better Auth GET and POST handlers. The browser auth client uses the current page origin so local LAN phone testing does not send requests to the phone's own `localhost`.

Sessions are resolved from request headers by `src/lib/auth/guards.ts`. The guards load the user record from PostgreSQL so role and status decisions use current database values rather than relying only on the session snapshot.

The signup UI offers phone OTP signup or Google OAuth. Phone signup chooses a username after OTP verification. Google signup returns to `/register/complete`, where a new account claims a username through `/api/account/username` before phone verification. Usernames are case-insensitively checked and saved in lowercase with display casing retained; the update is conditional on the field still being null, and Better Auth's username plugin is configured to make usernames immutable. The flow uses the existing rate-limited phone OTP endpoints. Sign-in retains username/password, phone/password, and Google OAuth.

The phone OTP plugin delegates delivery to the modular callback in `src/lib/auth/sms.ts`. In local development only, with `REVOK_DEV_OTP_TERMINAL=true`, it writes Better Auth's generated OTP to the development terminal and masks the phone to its last four digits. The module throws during startup if this flag is enabled outside development. When disabled, delivery fails closed. Account verification routes normalize Indian 10-digit and `+91` inputs to the same national form used by signup and phone/password login; they detect already-linked numbers before sending or consuming OTPs. No SMS request is made; a future provider adapter can replace this callback.

## Authorization and account status

- `requireLogin` allows `ACTIVE` and `RESTRICTED`, and rejects `BANNED` and `DELETED`.
- `requireCanBrowse` uses that same access policy.
- `requireActiveUser` is required for sensitive account changes and `requirePhoneVerified` adds verified-phone enforcement.
- `requireAdmin` additionally requires an active `ADMIN` or `SUPER_ADMIN` account.
- Better Auth's session-create database hook refuses session creation for banned/deleted users; the admin BAN action also deletes that user's existing sessions.
- Admin page authorization in `src/lib/auth/authorization.ts` delegates to the shared server guard. Admin APIs call the same guard directly.
- `/api/admin/users` searches/filter accounts only after `requireAdmin`, returns a minimal account projection, and is rate-limited. Status actions are same-origin, rate-limited, and role-aware in `features/admin/users/user-management.ts`: ADMIN can act on USER accounts; only SUPER_ADMIN may manage ADMIN accounts; no user-moderation action can target a SUPER_ADMIN. Bans delete active sessions.
- `/api/admin/users/[userId]/role` requires `requireSuperAdmin` and permits only USER/ADMIN roles. Promotion requires an active target with a username and verified email or phone. Role changes revoke the target's existing sessions. `/api/admin/super-admin/transfer` is separate, same-origin, rate-limited to one request per hour per actor, requires typed confirmation and the current signed-in email, and atomically promotes an existing eligible Admin while demoting the actor and revoking both sessions. There is no API that accepts a browser-supplied SUPER_ADMIN role.
- `/admin` counts real database records and displays account search, report queue counts, and recent security audit activity. Only Super Admins can see audit rows and role-changing controls. Ordinary Admins see account/report administration but not the audit log.
- `scripts/bootstrap-super-admin.ts` is an explicit deployment/operator command. `REVOK_SUPER_ADMIN_EMAIL` must identify an existing active account with `emailVerified=true` and a linked `google` Account record. In one PostgreSQL transaction it obtains `pg_advisory_xact_lock`, checks for the permanent `INITIAL_SUPER_ADMIN_BOOTSTRAPPED` audit marker, demotes all prior ADMIN/SUPER_ADMIN roles, promotes the configured user, and stores the marker. It does not create users, change statuses, or delete data. The marker and role updates are atomic; rerunning after success fails. No migration is required. Database superuser/operator access can still modify records outside app controls.
- `databaseHooks.session.create.before` calls `ensureConfiguredSuperAdmin` for the configured active, email-verified Google account. It sets a separate one-time `CONFIGURED_SUPER_ADMIN_OWNER_SET` audit marker under a PostgreSQL advisory transaction lock, promotes that account, demotes any prior Super Admin to Admin, and revokes the affected users' sessions before the new session is created. A later configuration for another account does not silently change ownership; use the explicit transfer API. Configure `REVOK_SUPER_ADMIN_EMAIL` in the local ignored `.env.local`/`.env` or deployment environment. No schema migration is required.
- A normal successful sign-in goes through `/auth/continue`, which checks the database-backed role server-side and redirects active Admin/Super Admin accounts to `/admin`; explicit callback destinations are retained.
- `GET /api/admin/users/[userId]` requires an active Admin and returns a limited account detail projection: phone number, lost/found report titles, statuses, moderation states, deleted state, and claim counts. It does not return email, private verification details, contact details from reports, or image storage data. This personal data is available only through the server-guarded admin endpoint.
- Public pages remain public. Protected pages and APIs reject banned/deleted users, and the auth layer refuses new sessions for them.

`src/lib/auth/access.ts` captures the intended role-independent status policy for feature code: restricted accounts can browse, while report creation, messaging, claims, and phone changes require an active account; report creation, messaging, and claims also require phone verification.

## Rate limiting

Better Auth's limiter is enabled with in-memory storage and explicit path rules in `auth.ts`: 5 username sign-ins per minute, 5 phone/password sign-ins per minute, 3 Better Auth OTP sends per hour, and 5 OTP verifications per 15 minutes. Better Auth's default limiter also remains enabled for other auth paths.

`src/lib/security/rate-limit.ts` provides fixed-window limits for custom account routes. It hashes user/phone identifiers before using them as in-memory keys. The custom limits are 3 phone OTP sends per phone number and 5 per user per hour; 5 verification attempts per phone number and 20 per user per 15 minutes; and 5 account setup attempts per user per hour.

Both limiters are process-local. They reset on restart, can be bypassed by distributing traffic across instances, and require shared storage (such as Redis) before a multi-instance production deployment. IP identification and proxy trust have not been separately configured or verified.

## Trusted origins and configuration

Local development retains `http://localhost:3000` as a trusted origin. When `BETTER_AUTH_URL` is a valid URL, its origin is added; no production hostname is assumed. `REVOK_LOCAL_NETWORK_ORIGIN` can add one HTTP private/local origin while `NODE_ENV=development`, to support same-Wi-Fi phone testing; public origins and production use are rejected by this configuration. Required variables are `DATABASE_URL` and `BETTER_AUTH_URL`; Google OAuth additionally uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `REVOK_DEV_OTP_TERMINAL` must only be set to `true` for local development. No SMS provider is configured in this phase.

## Database model

`prisma/schema.prisma` contains Better Auth models and user role/status fields, a nullable 280-character `User.about` profile field, categories, lost/found items, images, matches, claims, chat, notifications, moderation, audit logs, and deletion records. Migration `20261028120000_expand_item_reports` adds optional subcategory/model/material/visible marks/time/location detail and lost-contact/found-custody fields to the existing item models. No new report tables or auth schema were introduced in this phase.

## Profile

`PATCH /api/account/profile` requires an active account and is rate-limited per user. Zod bounds the display name, about text, and any existing photo reference. The profile UI edits name/about and uses `POST /api/account/profile/photo` for JPEG/PNG/WebP uploads, including small images, up to 8 MB. Active session, same-origin, signature validation, and per-user rate limits are enforced. Phone changes reuse the send/verify OTP endpoints; the current number is replaced only after the new number is verified.

`POST /api/items` accepts lost/found reports only from active users with verified phones. The endpoint applies a per-user in-memory limit, validates report fields and image signatures, and stores report rows and image metadata in the existing Prisma models. New reports retain the schema's `PENDING` moderation status. `PATCH` and `DELETE /api/items/[id]` require same-origin, active, phone-verified sessions, rate-limit mutations, and include `id + authenticated userId + deletedAt:null` in the database mutation predicate. Edits return moderation to `PENDING`; resolve/reopen updates the item lifecycle status; delete is a soft delete. Public list/detail reads only return active approved records, and public list DTO fields explicitly omit private details and owner IDs. The server-guarded `/admin/reports` queue and `PATCH /api/admin/items/[id]` allow active admins to approve, flag, or block reports, with moderation and audit events. Pending reports are private except to their owner and authorized admins.

Profile photos remain under `public/uploads/`. Item photos use random keys in `.data/uploads/items` for local development, or the S3-compatible API when `UPLOAD_STORAGE=s3`. The S3 adapter uses Node crypto and AWS Signature Version 4; no SDK dependency is needed. Configure `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`; optionally configure `S3_ENDPOINT` for an S3-compatible endpoint (for example, an R2 endpoint). Production rejects filesystem mode. The upload and read route proxy image bytes and authorize access against report state/ownership before touching storage. A real bucket, credentials, IAM policy, and deployed persistent PostgreSQL are still required and were not verified here. Photo metadata is not stripped, so users are warned to remove GPS/location data before upload.
