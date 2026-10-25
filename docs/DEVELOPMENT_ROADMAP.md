# REVOK Development Roadmap

## Phase 1 - Foundation
- [x] Next.js
- [x] PostgreSQL
- [x] Prisma
- [x] Better Auth
- [x] Google OAuth
- [x] Authentication guards
- [x] Zod foundation
- [x] API error handling
- [x] Rate limiting (in-memory; single-process only)
- [x] Security hardening (account-status and admin guard review)
- [ ] Auth abuse testing

Phase 1 verification note: unit tests cover the fixed-window limiter, access policy, local terminal OTP delivery, and production fail-closed behavior. Live auth abuse tests and shared production rate-limit storage remain pending.

## Phase 2 - Basic Website
- [x] Home page (no fabricated listings; clear unavailable-feature state)
- [x] Navbar
- [x] Login page
- [x] Signup page UI (opt-in local terminal OTP; no SMS provider)
- [x] Profile editor (display name, about, local photo upload, OTP-verified phone replacement)
- [x] Dashboard page (basic authenticated shell)
- [x] Responsive mobile-first landing page and account navigation (physical browser/device review remains)

Phase 2 note: Home and navigation are responsive. Profile edits persist through guarded APIs; profile photo upload is available locally. Report creation, owner history, and approved-report search are implemented in Phase 3. Physical-device review remains pending.

Authentication UI note: signup now presents Google OAuth and phone OTP options; Google signups must verify a phone on `/register/complete`. Live Google OAuth and real SMS remain unverified.

Account setup note: phone signup chooses an available immutable username after OTP. New Google signups choose an available immutable username before phone verification. Profile photo uploads accept small valid JPEG/PNG/WebP files up to 8 MB; profile image URL entry is not shown in the editor.

## Phase 3 - Lost & Found
- [x] Lost and found report creation APIs
- [ ] Create/edit/remove (creation implemented; edit/remove pending)
- [x] Search approved public reports by title, description, category, and location
- [ ] Filters
- [ ] Item details
- [x] JPEG/PNG/WebP image upload for reports (local filesystem only)
- [x] Owner dashboard report history and moderation status
- [ ] Moderation review/approval interface (pending reports remain private)
- [ ] Durable object storage for deployment

## Phase 4 - Matching
- [ ] Matching algorithm
- [ ] Potential matches
- [ ] Match status
- [ ] Match notifications

## Phase 5 - Claims & Handover
- [ ] Claims
- [ ] Verification
- [ ] Handover code
- [ ] Returned lifecycle

## Phase 6 - Communication
- [ ] Chat
- [ ] Notifications
- [ ] Message moderation

## Phase 7 - Administration
- [ ] Admin dashboard
- [ ] User moderation
- [ ] Report moderation
- [ ] Claims management
- [ ] Audit logs
- [ ] Security events

## Phase 8 - Intelligence
- [ ] AI moderation
- [ ] Chatbot
- [ ] Advanced matching
- [ ] Suspicious activity detection

## Phase 9 - Advanced Features
- [ ] GPS/location privacy
- [ ] Friend circles
- [ ] Camera-first found item reporting

## Phase 10 - Release
- [ ] Security testing
- [ ] Performance testing
- [ ] PWA
- [ ] Production database
- [ ] Object storage
- [ ] Deployment
- [ ] Final documentation
