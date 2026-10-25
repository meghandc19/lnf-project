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
- [x] Profile editor (display name, about, photo URL; image upload pending)
- [x] Dashboard page (basic authenticated shell)
- [x] Responsive mobile-first landing page and account navigation (physical browser/device review remains)

Phase 2 note: `/items` and report routes show honest empty/coming-soon states because item CRUD/search APIs and secure upload storage do not exist. The home page has direct report-lost, report-found, and search actions. Profile edits are persisted through a guarded API; the about field is added by a nullable Prisma migration. Dashboard reports only real account age and database counts. Physical-device review and item history remain pending.

Authentication UI note: signup now presents Google OAuth and phone OTP options; Google signups must verify a phone on `/register/complete`. Live Google OAuth and real SMS remain unverified.

## Phase 3 - Lost & Found
- [ ] Lost item API
- [ ] Found item API
- [ ] Create/edit/remove
- [ ] Search
- [ ] Filters
- [ ] Item details
- [ ] Image upload

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
