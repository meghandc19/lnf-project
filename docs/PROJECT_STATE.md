# REVOK Project State

Last verified: 2026-10-25

## Project goal

Build a community lost-and-found application for reporting, searching, matching, claiming, and managing lost and found items. The current product is a responsive web application; PWA and native applications are not part of the current phase.

## Current stack

- Next.js 16.3.5 App Router, React 19, TypeScript, Tailwind CSS
- PostgreSQL 18.6 and Prisma 7.10.0
- Better Auth 1.7.5, Zod

## Verified implementation

### Authentication and account

- Better Auth is mounted at `/api/auth/[...all]` and manages sessions.
- Google OAuth, username/password, and phone-number/password client flows are present.
- Signup presents Google OAuth and phone OTP options. Google signup returns to /register/complete, where phone verification is required before protected account actions are available. Sign-in presents username/password and Google, and retains phone/password sign-in.
- Phone OTP signup and account phone verification routes are present, with six-digit OTP validation and three Better Auth OTP attempts.
- OTP delivery uses Better Auth's generated code and is available in local development only when `REVOK_DEV_OTP_TERMINAL=true`. The terminal message masks the phone to its last four digits. It fails closed in other environments and sends no SMS.
- Account setup is available at `POST /api/account/setup` and requires an active, phone-verified account.
- Logout is available in the authenticated UI through the Better Auth client.
- The shared site header checks the current database-backed session: signed-in users see profile and dashboard links in place of login/signup actions. The current REVOK logo is used in the shared header, footer, and auth pages.
- `/profile` allows active users to update their display name, a 280-character about field, and an HTTPS or same-site profile-image URL. The endpoint requires an active session and is rate-limited. Image file upload is not implemented.
- `/dashboard` shows real lost/found item counts and account age. Item counts and completed handover history remain empty until the corresponding workflows exist.

### Security

- Better Auth rate limiting is enabled with in-memory storage. Username and phone password sign-in are limited to 5 requests per minute; Better Auth phone OTP send is limited to 3 per hour; OTP verification is limited to 5 per 15 minutes.
- Custom account phone OTP send is limited to 3 per phone number and 5 per user per hour; verification to 5 per phone number and 20 per user per 15 minutes; setup to 5 per user per hour.
- Custom limiter keys hash user/phone identifiers. The limiter is process-local, resets on restart, and is not suitable for coordinating multiple instances.
- Shared guards load the current account status from PostgreSQL. `ACTIVE` and `RESTRICTED` accounts may authenticate and browse; sensitive actions require `ACTIVE`; `BANNED` and `DELETED` accounts cannot create sessions or access guarded routes. Banning a user revokes existing sessions.
- Admin APIs and pages perform server-side role and active-status checks. The admin test action page is also protected server-side.
- Trusted origins include localhost, the origin derived from `BETTER_AUTH_URL` when valid, and an optional private/local `REVOK_LOCAL_NETWORK_ORIGIN` only in development. No production domain is hard-coded.

## Implemented routes and pages

- `/`, `/items`, `/how-it-works`, `/about`, `/report/lost`, `/report/found`, `/login`, `/register`, `/register/complete`, `/profile`, `/dashboard`, `/admin`, `/admin/test-actions` (redirects to `/admin`)
- `/api/auth/[...all]`
- `/api/account/setup`, `/api/account/phone/send-otp`, `/api/account/phone/verify`
- `PATCH /api/account/profile`
- `/api/admin/users`, `/api/admin/users/[userId]`
- `/api/test/protected` and `/api/test/active` are development verification routes.

The profile-about migration was applied to the configured local PostgreSQL database at `localhost:5432`; production migration status is not known and must be checked during deployment.

## Not implemented or unresolved

- Lost/found item APIs, persisted search and filters, uploads, match generation, claims, handover, chat, notifications, moderation workflows, and production deployment are not implemented. Corresponding pages are honest empty or coming-soon states.
- Profile photos can only be referenced by HTTPS or same-site URL; upload storage is not configured. Phone-based Google OAuth still depends on matching local provider callback configuration.
- Google OAuth requires configured credentials and callback settings; credential values have not been inspected or reported here.
- Production SMS/OTP delivery, shared rate-limit storage, proxy/IP trust configuration, and multi-instance abuse controls remain unresolved.
- Authentication behavior has not been regression-tested against live Google credentials, a configured database, or a real SMS provider in this hardening pass.
- Item reports, search, uploads, matching, claims, messaging, and notifications are not available. Public pages show explicit coming-soon/empty states.
- The homepage uses a local banner image; no fabricated listings or external item-image URLs remain.
- `npm run build` previously passed. Google-hosted font dependencies have been removed so local builds do not need that font download.

## Security design rules

- Do not expose private user data to public callers.
- Authorization is enforced on the server; frontend visibility is not an access control.
- Restricted accounts may browse but may not perform protected actions.
- Banned accounts are denied access through protected application routes; permanent deletion keeps only minimal audit/deletion records.
- Phone verification is required for sensitive user actions.
- Public locations must not expose precise private GPS data by default.
- Potential matches do not prove ownership.
- Responsive behavior is implemented through CSS breakpoints; physical-device visual review has not been verified.
- The homepage statically imports the local banner asset so Next.js emits a content-hashed image URL when the file changes.
