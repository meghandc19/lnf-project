# API Status

Status reflects inspected route-handler code as of 2026-10-25. Models in Prisma are not counted as APIs.

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
| `POST /api/items` | Implemented | Active account plus verified phone required; same-origin; 5 reports per user per hour; validates item details, category, past date, and up to 3 JPEG/PNG/WebP images at 5 MB each. Creates a lost or found report with default `PENDING` moderation. |
| `GET /api/items` | Implemented | Public read of active, non-deleted `APPROVED` lost/found reports only; optional `type=LOST` or `type=FOUND`; capped at 50. Does not expose owner contact data. |
| `GET /api/uploads/items/[filename]` | Implemented for local development | Item image bytes are outside `public/`; image access requires an approved active report or its owner account. Uses local `.data/uploads`; production object storage is not configured. |

Better Auth rate rules: username sign-in 5/minute; phone/password sign-in 5/minute; OTP send 3/hour; OTP verify 5/15 minutes. Better Auth also applies its default limiter to other auth paths. Storage is in-memory and process-local. Local terminal OTP requires `REVOK_DEV_OTP_TERMINAL=true` and `NODE_ENV=development`; production fails closed.

## Admin — implemented

| Endpoint | Methods | Authorization |
|---|---|---|
| `/api/admin/users` | `GET` | Shared server-side guard requires active ADMIN or SUPER_ADMIN. Returns admin user listing. |
| `/api/admin/users/[userId]` | `PATCH` | Shared server-side guard; supports `RESTRICT`, `BAN`, `RESTORE`, and `DELETE`. |

Admin pages `/admin` and `/admin/test-actions` use server-side active-admin checks. The test action page calls the same protected API; UI restrictions are not relied on for authorization.

## Development verification routes

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/test/protected` | `GET` | Checks authenticated user resolution. Restricted users pass; banned/deleted users do not. |
| `/api/test/active` | `GET` | Checks active-account enforcement. |

## Not implemented

There are no report edit/delete, moderation review/approval, matching, claim, handover, chat, notification, or production administration workflows exposed as APIs yet. Local filesystem image storage is not appropriate for durable multi-instance production deployment.

## Public UI routes

- `/` includes working lost/found report links and describes owner dashboard history and review-before-publication.
- `/register` offers Google signup and phone OTP signup. Phone signup claims a username after OTP. New Google signup claims an immutable username on `/register/complete`, then verifies a phone before continuing.
- `/items` searches active approved reports by item title, description, category, and location. Pending reports remain private.
- `/report/lost` and `/report/found` accept title/category/description/location/date fields and optional photos via file picker or drag-and-drop. Submission requires an active, phone-verified account.
- `/how-it-works` and `/about` describe the planned process and privacy guidance.
- `/profile` edits persisted display name and about text for active users; JPEG/PNG/WebP photo upload supports picker and drag/drop (8 MB, with no minimum dimensions). Phone replacement requires OTP verification of the new number before it replaces the current one.
- `/dashboard` displays current account details, real lost/found report counts and account age, plus the user's latest reports and moderation status.
- `/admin` displays a database-backed registered-user count and latest account list for authorized active admins.

## Verification coverage

- `npm run test:security`: 13 tests pass for fixed-window behavior, hashed limiter keys, account access policy, development OTP output/masking, production fail-closed rules, profile input/photo URL validation, and Indian phone normalization. Report/upload-specific automated tests have not yet been added.
- `npm run lint`: passed for this change.
- `npx tsc --noEmit`: passed for this change.
- `npx prisma validate`: passes; the local PostgreSQL database at localhost has applied `20261025090000_add_user_about`.
- `npm run build`: passed for this change; new routes appear in the production route listing.
- Local HTTP smoke checks returned 200 for `/`, `/items`, `/report/lost`, `/report/found`, and `GET /api/items` (0 approved reports returned). This confirms public page/API loading, not authenticated report submission or physical handset review.
- Report submission, image writes, profile upload, and dashboard report history have not yet been end-to-end exercised with an authenticated account. Upload-specific automated tests have not yet been added.
- Live Google OAuth, database-backed sessions, username/phone sign-in, and signup OTP were not end-to-end tested during this pass; no real SMS was sent.
- Physical phone browser testing, including Google OAuth over LAN, remains pending. The private network origin is opt-in through `REVOK_LOCAL_NETWORK_ORIGIN` in development; Google OAuth callback setup is provider-specific.
