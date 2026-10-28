# API Status

Status reflects inspected route-handler code as of 2026-10-28. Models in Prisma are not counted as APIs.

## Authentication — implemented through Better Auth

| Endpoint family | Status | Notes |
|---|---|---|
| `/api/auth/[...all]` | Implemented | Better Auth catch-all for supported GET/POST actions, including session, OAuth, username/password, phone/password, signup OTP and logout. |
| `POST /api/account/phone/send-otp` | Implemented; local delivery only | Requires active login; accepts the same 10-digit or `+91` Indian formats as signup/login and normalizes before rate limiting and Better Auth. Checks for a phone already linked to another account. Limits: 3 sends per phone and 5 per user per hour. Local OTP requires the explicit dev flag; no SMS is sent. |
| `POST /api/account/phone/verify` | Implemented; live delivery unverified | Requires active login; accepts/normalizes the same phone formats, validates six-digit code, with 5 attempts per phone and 20 per user per 15 minutes. Existing linked numbers return account-login guidance. |
| `POST /api/account/setup` | Implemented | Requires active and phone-verified account; 5 attempts per user per hour. |
| `/api/account/username` | Implemented | Authenticated GET availability check and same-origin POST claim; case-insensitive lookup, 40 checks/hour and 5 claim attempts/hour per user. Usernames are set once and use existing schema fields. |
| `PATCH /api/account/profile` | Implemented | Requires active account and same-origin request; 10 updates per user per hour; validates display name, 280-character about text, and HTTPS/same-site image URL. |
| `POST /api/account/profile/photo` | Implemented for local development | Active-account and same-origin guarded; per-user rate limit; JPEG/PNG/WebP signature validation and 8 MB limit. Small valid image files are accepted. Profile images are public URLs under local `public/uploads`; production object storage is not configured. |
| `POST /api/items` | Implemented | Active account plus verified phone required; same-origin; 5 reports per user per hour; validates lost/found fields, category, past date, and up to 3 JPEG/PNG/WebP images at 5 MB each. Stores optional private verification details separately from public fields. New reports use `PENDING` moderation. |
| `GET /api/items` | Implemented | Public read of active, non-deleted `APPROVED` reports only; optional type; capped at 50. Uses an explicit public field selection and omits private details, account IDs, and contact information. |
| `/api/items/[id]?type=LOST|FOUND` | Implemented | `GET` returns approved active public reports and permitted owner's own reports; private verification fields are included only for that owner. `PATCH` and `DELETE` require same-origin, active phone-verified owner sessions and a 30-per-hour user limit. Edit resets moderation to `PENDING`; status can be closed/reopened; delete is a soft delete. |
| `GET /api/uploads/items/[filename]` | Implemented | Authorizes approved active reports or the owning active/restricted account, rejects banned/deleted sessions, and reads bytes from configured storage. |

Better Auth rate rules: username sign-in 5/minute; phone/password sign-in 5/minute; OTP send 3/hour; OTP verify 5/15 minutes. Better Auth also applies its default limiter to other auth paths. Storage is in-memory and process-local. Local terminal OTP requires `REVOK_DEV_OTP_TERMINAL=true` and `NODE_ENV=development`; production fails closed.

## Admin — implemented

| Endpoint | Methods | Authorization |
|---|---|---|
| `/api/admin/users` | `GET` | Shared server-side guard requires active ADMIN or SUPER_ADMIN. Returns admin user listing. |
| `/api/admin/users/[userId]` | `PATCH` | Shared server-side guard; supports `RESTRICT`, `BAN`, `RESTORE`, and `DELETE`. |
| `/api/admin/items/[id]?type=LOST|FOUND` | `PATCH` | Requires active ADMIN or SUPER_ADMIN server-side, same-origin, and is rate-limited to 60 reviews/hour per admin. Supports APPROVED, FLAGGED, and BLOCKED; records moderation and audit events. |

Admin pages `/admin`, `/admin/reports`, and `/admin/test-actions` use server-side active-admin checks. The report queue omits owner contact and private verification details. Pending/flagged images are available only to active admins or the report owner. UI restrictions are not relied on for authorization.

## Development verification routes

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/test/protected` | `GET` | Checks authenticated user resolution. Restricted users pass; banned/deleted users do not. |
| `/api/test/active` | `GET` | Checks active-account enforcement. |

## Not implemented

There are no matching, claim, handover, chat, notification, or report contact workflows exposed as APIs yet. Item photo storage supports local filesystem development and S3-compatible production object storage via the built-in SigV4 client; cloud credentials and a bucket still need to be configured and tested for a deployment.

## Public UI routes

- `/` includes working lost/found report links and describes owner dashboard history and review-before-publication.
- `/register` offers Google signup and phone OTP signup. Phone signup claims a username after OTP. New Google signup claims an immutable username on `/register/complete`, then verifies a phone before continuing.
- `/items` searches active approved reports by keyword (title, description, brand, model), type, category, color, location, brand/model, date range, newest/relevance sorting, and pagination. Results link to public details.
- `/items/lost/[id]` and `/items/found/[id]` show approved public report details; an owner can also view their own pending or closed report. Private verification details are owner-only. The current editor does not replace/remove attached photos.
- `/report/lost` and `/report/found` accept item identification, category/subcategory, date/time, location details, private verification detail, found-item custody status, and optional photos via picker or drag-and-drop. Submission requires an active, phone-verified account.
- `/how-it-works` and `/about` describe the planned process and privacy guidance.
- `/profile` edits persisted display name and about text for active users; JPEG/PNG/WebP photo upload supports picker and drag/drop (8 MB, with no minimum dimensions). Phone replacement requires OTP verification of the new number before it replaces the current one.
- `/dashboard` displays current account details, real lost/found report counts and account age, and the user's full report history with moderation and lifecycle status, view, edit, resolve/reopen, and soft-delete actions.
- `/admin` displays a database-backed registered-user count and latest account list for authorized active admins.

## Verification coverage

- `npm run test:security`: 13 tests pass for fixed-window behavior, account access policy, local OTP behavior, profile validation, and phone normalization.
- `npm run test:items`: 7 tests pass for report validation, accepted custody/status fields, moderation decisions, owner-scope query shape, and S3-compatible signed PUT/GET/DELETE behavior against a local test server. This does not verify a real cloud account or provider policy.
- `npm run lint`, `npx tsc --noEmit`, `npx prisma validate`, `npx prisma migrate status`, and `npm run build`: passed after this feature pass.
- Local PostgreSQL is up to date with 10 migrations, including `20261028120000_expand_item_reports` and generated follow-up `20261028171254_expand_item_reports` (Prisma reconciled its generated indexes with the schema). No reset was run.
- Production-server HTTP smoke checks returned 200 for `/items`, `/report/lost`, `/report/found`, `/login`, `/register`, and `GET /api/items`. This confirms public page/API loading, not authenticated report submission or physical handset review.
- Authenticated report submission, owner edit/delete, and cloud object storage were not end-to-end exercised in this pass; focused tests cover Zod validation and the owner filter helper, not live multi-user database isolation. S3-compatible request signing and real bucket permissions also need an integration test against the chosen provider.
- Live Google OAuth, database-backed sessions, username/phone sign-in, and signup OTP were not end-to-end tested during this pass; no real SMS was sent.
- Physical phone browser testing, including Google OAuth over LAN, remains pending. The private network origin is opt-in through `REVOK_LOCAL_NETWORK_ORIGIN` in development; Google OAuth callback setup is provider-specific.
