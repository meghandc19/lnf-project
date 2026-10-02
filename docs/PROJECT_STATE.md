# REVOK Project State

Last Updated: 2026-10-02

## Project
REVOK - Lost and Found Application

## Goal
A real full-stack web application for reporting, searching,
matching, claiming and managing lost and found items.

## Development Target
Responsive web application first.
PWA later.
No native Android application currently.

## Current Environment
- Next.js 16.3.5
- React
- TypeScript
- Tailwind CSS
- PostgreSQL 18.6
- Prisma 7.10.0
- Better Auth
- Zod
- Git/GitHub

## Completed

### Project
- Next.js project created
- TypeScript configured
- Tailwind configured
- Git repository created
- GitHub repository connected

### Database
- PostgreSQL configured
- REVOK database created
- Prisma configured
- Prisma migrations working
- Main database schema created

### Authentication
- Better Auth configured
- Google OAuth configured
- Username/password authentication foundation
- Phone/password authentication foundation
- Phone OTP plugin foundation
- Session handling
- User roles
- User account statuses

### Backend Security Foundation
- Authentication guards
- Admin guards
- Phone verification guard
- API error class
- API error handler
- Zod validation foundation

### Testing
- Auth API tested
- Google login tested
- Session tested
- Protected API tested
- Logged-in request returns 200
- Logged-out request returns 401

## Current User State During Development
Google-authenticated test user works.
Phone verification is currently false.
MSG91 is not connected yet.

## Current Stage
Backend foundation hardening.

## Immediate Next
1. Rate limiting
2. Account-status enforcement
3. Security configuration
4. Auth abuse tests
5. Database/index review
6. Backend checkpoint
7. Basic REVOK frontend shell

## Not Yet Built
- Lost item APIs
- Found item APIs
- Search/filter APIs
- Image storage/upload system
- Matching engine
- Claims
- Handover verification
- Chat
- Notifications
- Admin dashboard APIs
- AI moderation
- Chatbot
- GPS features
- Friend circles
- MSG91 production OTP
- PWA
- Production deployment

## Important Rules
- Do not expose private user information.
- Backend must enforce authorization.
- Frontend must never be trusted for permissions.
- Restricted users can browse/search but cannot perform sensitive actions.
- Banned accounts are permanently removed with minimal deletion/audit record.
- Phone verification is required for sensitive actions.
- Public location must not expose precise private GPS by default.
- Potential matches are not proof of ownership.