# REVOK 1.1 deployment handoff

This guide describes configuration only; the site has not been deployed and no live MSG91 delivery has been tested.

## Before deployment

1. Create a production PostgreSQL database and use its connection URL as `DATABASE_URL`.
2. Add the Vercel project and configure the production domain. Set `BETTER_AUTH_URL` to the full HTTPS origin, such as `https://revoke.example` (replace with your actual domain). Register the same origin and Better Auth callback URL with Google if Google sign-in is enabled.
3. Add `BETTER_AUTH_SECRET` with a cryptographically random secret of at least 32 characters. Keep all secret values in Vercel Environment Variables, never in Git.
4. Configure persistent image storage: `UPLOAD_STORAGE=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Add `S3_ENDPOINT` only for an S3-compatible service using a custom endpoint. Give the credentials only the bucket permissions needed for object get/put/delete. New profile images and item photos both use this storage in production.
5. Apply the checked-in Prisma migrations to the production database in a controlled release step (`npx prisma migrate deploy`). This includes the `RateLimit` table required by Better Auth's production rate limiter. Do not run `migrate reset` against production.

## Configure MSG91

In MSG91, obtain the Auth Key from the account's API / Authkey area and create or select an OTP template in its OTP product. Copy that template's ID. The template must include MSG91's OTP placeholder (`##OTP##`) and satisfy any sender, DLT, and country requirements applicable to your account. Check the current [MSG91 OTP API documentation](https://docs.msg91.com/otp) and the [SendOTP reference](https://docs.msg91.com/otp/sendotp) while configuring the account.

Add these variables to Vercel for the Production environment:

```env
MSG91_AUTH_KEY=<private MSG91 Auth Key>
MSG91_OTP_TEMPLATE_ID=<MSG91 OTP Template ID>
MSG91_OTP_LENGTH=6
MSG91_OTP_EXPIRY_MINUTES=5
MSG91_ENABLED=false
```

The code requires a non-empty Auth Key and Template ID, a six-digit OTP (the existing UI is fixed at six digits), and an expiry from 1–10080 minutes. **Keep `MSG91_ENABLED=false` until the template, sender/account permissions, and production values are checked.** Then set it to `true` and redeploy. The application uses MSG91's send and verify endpoints; a provider success response is required before an OTP can verify. Resending starts a new OTP through the existing send flow and has a 60-second cooldown and a maximum of three sends per hour per phone. Better Auth permits up to three attempts for an issued OTP and applies a persistent five-per-15-minute verify request limit in production.

## Deploy and test

1. In Vercel, add the environment variables to the intended environment(s), connect the Git repository, and deploy. The project uses the standard Next.js build; Prisma Client generation is part of the package lifecycle.
2. Review the build output and the server-only Admin page at `/admin/security` while signed in as an Admin. It shows only configuration status, never secret values. Apply the migration before expecting the persistent limiter check to pass.
3. After enabling MSG91, use a phone number you control to register. Confirm the SMS arrives, enter the code, and confirm that signup succeeds. Then verify a phone change from profile settings and test invalid, expired, and resend cases. Check the MSG91 logs for delivery status; do not copy OTP values into app logs or support messages.
4. Test Google sign-in if enabled and upload a profile photo and item photo to confirm the S3 bucket policy and image routes work.

## Required configuration summary

Required for normal production operation: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPLOAD_STORAGE=s3`, the four required S3 variables, and the five MSG91 variables above. Google sign-in additionally needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `REVOK_SUPER_ADMIN_EMAIL` is used only for the configured Super Admin owner flow. `S3_ENDPOINT` is optional for AWS S3.

The Admin checklist distinguishes unconfigured from unverified values, but it does not validate Google callback registration, S3 permissions, MSG91 account/template approval, or actual message delivery. Custom application route rate limits still use process-local memory; a shared store is needed for consistent enforcement across Vercel instances. Review proxy/IP trust and deployment logging before launch.
