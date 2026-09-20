import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber, username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.BETTER_AUTH_URL,

  account: {
    encryptOAuthTokens: true,
  },

  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            prompt: "select_account",

            mapProfileToUser: (profile) => {
              const email =
                typeof profile.email === "string"
                  ? profile.email.toLowerCase()
                  : "";

              const base =
                email
                  .split("@")[0]
                  .replace(/[^a-z0-9_.]/g, "")
                  .slice(0, 18) || "user";

              const suffix = createHash("sha256")
                .update(email)
                .digest("hex")
                .slice(0, 6);

              return {
                username: `${base}_${suffix}`.slice(0, 30),
              };
            },
          },
        }
      : {},

  emailAndPassword: {
    enabled: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: "USER",
      },

      status: {
        type: "string",
        input: false,
        defaultValue: "ACTIVE",
      },
    },
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      immutableUsername: true,

      usernameValidator: (username) => {
        return /^[a-zA-Z0-9_.]+$/.test(username);
      },
    }),

    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        console.log(`OTP for ${phoneNumber}: ${code}`);
      },

      requireVerification: true,

      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,

      signUpOnVerification: {
        getTempEmail: (phoneNumber) => {
          const digits = phoneNumber.replace(/\D/g, "");
          return `${digits}@phone.lnf.local`;
        },

        getTempName: (phoneNumber) => {
          return phoneNumber;
        },
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});