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
- Signup presents Google OAuth and phone OTP options. New Google accounts choose a username on `/register/complete` and then verify a phone before protected account actions; phone signup chooses its username after OTP verification. Username availability is checked and usernames are immutable once set. Sign-in presents username/password and Google, and retains phone/password sign-in.
- Phone OTP signup and account phone verification routes are present, with six-digit OTP validation and three Better Auth OTP attempts.
- Account phone verification accepts and normalizes the same Indian 10-digit/`+91` formats used by signup and login. If a phone is already linked to another account during Google account setup, the signed-in user gets guidance to use the existing account instead of linking it again.
- OTP delivery uses Better Auth's generated code and is available in local development only when `REVOK_DEV_OTP_TERMINAL=true`. The terminal message masks the phone to its last four digits. It fails closed in other environments and sends no SMS.
- Account setup is available at `POST /api/account/setup` and requires an active, phone-verified account.
- Logout is available in the authenticated UI through the Better Auth client.
- The shared site header checks the current database-backed session: signed-in users see profile and dashboard links in place of login/signup actions. The current REVOK logo is used in the shared header, footer, and auth pages.
- `/profile` allows active users to update their display name and a 280-character about field. JPEG/PNG/WebP profile photos can be selected or dragged and dropped, including small images, up to 8 MB; the UI no longer asks users to paste a photo URL. A verified phone can be replaced only after the new number receives and verifies an OTP; the old number remains linked until verification succeeds. Profile upload requires an active session, same-origin request, and a per-user rate limit.
- `/report/lost` and `/report/found` submit title, category, description, general location, date/time, and up to three JPEG/PNG/WebP photos (5 MB each). Submission requires an active account with verified phone; report creation is rate-limited per user. Data persists in the existing LostItem/FoundItem and ItemImage models; no schema change was made.
- New reports use the schema's `PENDING` moderation status and remain private to their owner. `/dashboard` displays the current user's latest reports and review state, real lost/found counts, and account age. `/items` supports search by title, description, category, or location and only lists active `APPROVED` reports.
- Image bytes are checked against the declared MIME type and file signature. Profile photos are in ignored `public/uploads/`; item photos are in ignored `.data/uploads/` outside the public directory and are served only to the owner or after approval. EXIF/location metadata is not stripped; users are told to remove sensitive metadata before upload. This local filesystem implementation is for development; it does not provide durable shared storage for production or multiple instances.

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
- `/api/account/setup`, `/api/account/username`, `/api/account/phone/send-otp`, `/api/account/phone/verify`
- `PATCH /api/account/profile`, `POST /api/account/profile/photo`
- `POST /api/items` creates lost/found reports; `GET /api/items` returns active approved reports, optionally filtered by type; `GET /api/uploads/items/[filename]` enforces owner-or-approved visibility for private item image files.
- `/api/admin/users`, `/api/admin/users/[userId]`
- `/api/test/protected` and `/api/test/active` are development verification routes.

The profile-about migration was applied to the configured local PostgreSQL database at `localhost:5432`; production migration status is not known and must be checked during deployment. Username setup uses the existing nullable unique username fields and adds no schema migration.

## Not implemented or unresolved

- There is no moderation review/approval API or admin UI. Reports remain pending/private unless their moderation state is approved through an authorized operational process; until then they do not appear in `/items`.
- Report editing/removal, matches, claims, handover, chat, notifications, and production deployment are not implemented. Local uploads are not suitable as production durable storage; configure object storage and cleanup/migration before deployment.
- Phone-based Google OAuth still depends on matching local provider callback configuration.
- Google OAuth requires configured credentials and callback settings; credential values have not been inspected or reported here.
- Production SMS/OTP delivery, shared rate-limit storage, proxy/IP trust configuration, and multi-instance abuse controls remain unresolved.
- Authentication behavior has not been regression-tested against live Google credentials, a configured database, or a real SMS provider in this hardening pass.
- Matching, claims, handover, messaging, notifications, and moderation management are not implemented.
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
