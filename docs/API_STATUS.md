# API Status

Status reflects inspected route-handler code as of 2026-10-25. Models in Prisma are not counted as APIs.

## Authentication — implemented through Better Auth

| Endpoint family | Status | Notes |
|---|---|---|
| `/api/auth/[...all]` | Implemented | Better Auth catch-all for supported GET/POST actions, including session, OAuth, username/password, phone/password, signup OTP and logout. |
| `POST /api/account/phone/send-otp` | Implemented; local delivery only | Requires active login; 3 sends per phone number and 5 per user per hour. OTP delivery is development-terminal-only when explicitly enabled; no SMS is sent. |
| `POST /api/account/phone/verify` | Implemented; live delivery unverified | Requires active login; validates six-digit code, with 5 attempts per phone number and 20 per user per 15 minutes. |
| `POST /api/account/setup` | Implemented | Requires active and phone-verified account; 5 attempts per user per hour. |
| `PATCH /api/account/profile` | Implemented | Requires active account and same-origin request; 10 updates per user per hour; validates display name, 280-character about text, and HTTPS/same-site image URL. Photo upload is not implemented. |

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

There are no item CRUD/search/filter, upload, matching, claim, handover, chat, notification, moderation, or production administration workflows exposed as APIs yet.

## Public UI routes

- `/` introduces REVOK without sample listings or fabricated statistics. It includes actions for lost reports, found reports, and item search; the routes remain honest coming-soon states because their APIs are absent.
- `/register` offers Google signup and phone OTP signup. Google signup returns to `/register/complete`, which requires an authenticated active user to verify a phone before continuing.
- `/items` shows an honest empty state; search is unavailable until a listing API exists.
- `/report/lost` and `/report/found` explain that forms do not submit or save data yet.
- `/how-it-works` and `/about` describe the planned process and privacy guidance.
- `/profile` edits persisted display name, about text, and an HTTPS/same-site photo URL for active users.
- `/dashboard` displays current account details, real lost/found report counts and account age, and states which item history features are not available.
- `/admin` displays a database-backed registered-user count and latest account list for authorized active admins.

## Verification coverage

- `npm run test:security`: 10 tests pass for fixed-window behavior, hashed limiter keys, account access policy, development OTP output/masking, production fail-closed rules, and profile input/photo URL validation.
- `npm run lint`: passes without warnings.
- `npx tsc --noEmit`: passes.
- `npx prisma validate`: passes; the local PostgreSQL database at localhost has applied `20261025090000_add_user_about`.
- `npm run build`: passes. The app routes are included in the production build.
- Local HTTP smoke checks from the development host returned 200 for `/`, `/login`, `/register`, and `/items` through the configured private LAN origin; `/profile` correctly redirected unauthenticated requests to login. This confirms host-to-LAN access, not a physical handset review.
- Live Google OAuth, database-backed sessions, username/phone sign-in, and signup OTP were not end-to-end tested during this pass; no real SMS was sent.
- Physical phone browser testing, including Google OAuth over LAN, remains pending. The private network origin is opt-in through `REVOK_LOCAL_NETWORK_ORIGIN` in development; Google OAuth callback setup is provider-specific.
