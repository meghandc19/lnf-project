# REVOK Project State

Last verified: 2026-10-29

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
- Report forms collect category/subcategory, item identity and appearance, date/time, public location detail, owner-only verification detail, and found-item custody. Submission requires an active verified-phone account, validates image content, permits up to three 5 MB JPEG/PNG/WebP images, and is rate-limited per user. Data persists in the existing LostItem/FoundItem and ItemImage models, extended by the additive report migration.
- New and edited reports use `PENDING` moderation and remain private to their owner. The dashboard shows all owned non-deleted reports with moderation/lifecycle states and view/edit/resolve/reopen/soft-delete actions. Public search supports text, type, category, color, location, brand/model, date, sorting, and pagination; public details omit private fields.
- Image bytes are checked against declared MIME type and file signature. Profile photos remain local in ignored `public/uploads/`. Item photos are local in ignored `.data/uploads/` during development; production requires S3-compatible storage configured through environment variables. Image bytes are served through an authorization-checking route. EXIF/location metadata is not stripped; users are told to remove sensitive metadata before upload.

### Security

- Better Auth rate limiting is enabled with in-memory storage. Username and phone password sign-in are limited to 5 requests per minute; Better Auth phone OTP send is limited to 3 per hour; OTP verification is limited to 5 per 15 minutes.
- Custom account phone OTP send is limited to 3 per phone number and 5 per user per hour; verification to 5 per phone number and 20 per user per 15 minutes; setup to 5 per user per hour.
- Custom limiter keys hash user/phone identifiers. The limiter is process-local, resets on restart, and is not suitable for coordinating multiple instances.
- Shared guards load the current account status from PostgreSQL. `ACTIVE` and `RESTRICTED` accounts may authenticate and browse; sensitive actions require `ACTIVE`; `BANNED` and `DELETED` accounts cannot create sessions or access guarded routes. Banning a user revokes existing sessions.
- Admin APIs and pages perform server-side role and active-status checks. The admin test action page is also protected server-side.
- Admin authorization uses the database-backed `USER`, `ADMIN`, and `SUPER_ADMIN` roles. Ordinary admins may moderate normal accounts and reports; the Super Admin alone may appoint/remove admins, transfer ownership, and view security audit activity. Role/status actions validate on the server, require same-origin for mutations, use per-admin in-memory limits, and write audit rows.
- `REVOK_SUPER_ADMIN_EMAIL` may identify the dedicated owner account. During that account's sign-in, a Better Auth session hook verifies the exact email, active status, email verification, and linked Google provider, then promotes it in an audited PostgreSQL transaction protected by an advisory lock and a permanent audit marker. This also reconciles a different earlier bootstrap owner once; later ownership transfers remain explicit. The operator bootstrap command remains available. Runtime sign-in provisioning has not yet been exercised against the local database in this pass.
- Ownership transfer is a separate Super Admin-only operation to an existing active Admin with a username and verified email or phone. It requires a typed phrase and matching signed-in email, updates both roles atomically, revokes both users' sessions, and records the event. Role changes and bootstrap also revoke affected sessions. Ordinary role tools cannot modify a Super Admin account, preventing demotion or restriction of the last Super Admin through user-management routes.
- `/admin` shows database counts for users, account statuses, deletion records, lost/found reports, and reports awaiting review. Its guarded user-details endpoint shows phone number, lost/found report status and moderation summaries, and claim counts without returning private verification details. It searches and filters accounts through a guarded API. Recent account, role, and report moderation audit activity and role-management controls are visible only to Super Admins. The dashboard does not yet cover claims management, chat, settings, or comprehensive security events.
- Trusted origins include localhost, the origin derived from `BETTER_AUTH_URL` when valid, and an optional private/local `REVOK_LOCAL_NETWORK_ORIGIN` only in development. No production domain is hard-coded.

### Lost and found

- Lost/found forms collect title, category/subcategory, brand/model/color/material, visible identifying marks, date and approximate time, public location and optional extra location detail. Lost reports can note an office already contacted; found reports can record custody. Private verification detail is owner-only.
- Creation requires an active, phone-verified account and has a per-user rate limit. Photos are optional, capped at three JPEG/PNG/WebP files at 5 MB each, and validated by MIME and file signature.
- Dashboard history queries all of the signed-in user's non-deleted lost and found reports. Owners can open, edit, resolve/reopen, and soft-delete their own reports. Content edits return moderation to `PENDING`; owner authorization is included in every mutation query.
- Public search reads real `APPROVED`, active, non-deleted records and supports keywords, type, category, color, location, brand/model, date range, sorting, and pagination. Public detail pages exclude private verification detail and contact data. Owners may view their own pending/closed reports.
- `/admin/reports` lets active admins review pending/flagged reports and approve, flag, or block them. Server APIs enforce admin role, same-origin, and per-admin rate limits, and write moderation and audit events. Moderators do not see owner contact or private verification details.
- A focused item test suite covers server validation, accepted lifecycle and moderation fields, the owner-scope predicate, and signed object operations against a local fake S3 endpoint. It does not replace authenticated database or real-provider integration tests.

## Implemented routes and pages

- `/`, `/items`, `/items/lost/[id]`, `/items/found/[id]`, `/how-it-works`, `/about`, `/report/lost`, `/report/found`, `/login`, `/register`, `/register/complete`, `/auth/continue` (server-side role-based post-login redirect), `/profile`, `/dashboard`, `/dashboard/reports/[type]/[id]/edit`, `/admin`, `/admin/reports`, `/admin/test-actions` (redirects to `/admin`)
- `/api/auth/[...all]`
- `/api/account/setup`, `/api/account/username`, `/api/account/phone/send-otp`, `/api/account/phone/verify`
- `PATCH /api/account/profile`, `POST /api/account/profile/photo`
- `POST /api/items` creates lost/found reports; `GET /api/items` returns a safe public projection of active approved reports; `/api/items/[id]?type=...` supports safe detail access and owner-checked patch/soft-delete; `GET /api/uploads/items/[filename]` serves authorized owner/approved images.
- `PATCH /api/admin/items/[id]?type=...` lets an active admin approve, flag, or block a report and writes moderation/audit events.
- `/api/admin/users` (search/filter), `/api/admin/users/[userId]` (GET admin detail; PATCH status actions), `/api/admin/users/[userId]/role`, `/api/admin/super-admin/transfer`
- `/api/test/protected` and `/api/test/active` are development verification routes.

The profile-about migration and report migrations `20261028120000_expand_item_reports` and `20261028171254_expand_item_reports` are applied to the configured local PostgreSQL database at `localhost:5432`; production migration status is not known and must be checked during deployment. The report migration adds nullable fields to the existing report models; it does not replace authentication or report tables.

## Not implemented or unresolved

- Matches, claims, handover, chat, notifications, and production deployment are not implemented. New/edited reports stay pending until an admin reviews them.
- Report editing currently changes report text and metadata, not attached photos. Photo replacement/removal is a later improvement.
- Item images use local `.data/uploads/items` storage by default in development. Production requires `UPLOAD_STORAGE=s3` and S3-compatible credentials; this pass did not test a real object-store account or production bucket. Profile photos remain local under `public/uploads`.
- Phone-based Google OAuth still depends on matching local provider callback configuration.
- Google OAuth requires configured credentials and callback settings; credential values have not been inspected or reported here.
- Set `REVOK_SUPER_ADMIN_EMAIL` in the ignored local `.env` file before testing automatic Super Admin setup; sign out and sign in again to create a session and trigger the one-time promotion. Existing login callback destinations are preserved; a normal login redirects Admins to `/admin`.
- Production SMS/OTP delivery, shared rate-limit storage, proxy/IP trust configuration, and multi-instance abuse controls remain unresolved.
- Authentication behavior has not been regression-tested against live Google credentials, a configured database, or a real SMS provider in this hardening pass.
- Matching, claims, handover, messaging, notifications, and moderation management are not implemented.
- The homepage uses a local banner image; no fabricated listings or external item-image URLs remain.
- Google-hosted font dependencies have been removed so local builds do not need that font download. `npm run build` passed in this feature pass.

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
- The homepage renders directly without a blocking intro overlay or intro video request; the regular banner remains in place.
