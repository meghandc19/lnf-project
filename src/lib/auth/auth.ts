import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber, username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { deliverPhoneOtp } from "@/lib/auth/sms";
import { ensureConfiguredSuperAdmin } from "@/lib/auth/configured-super-admin";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const developmentHosts = [
  "localhost",
  "127.0.0.1",
  ...Object.values(networkInterfaces()).flatMap((entries) =>
    (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => entry.address),
  ),
];
const configuredAuthOrigin = (() => {
  if (!process.env.BETTER_AUTH_URL) return undefined;
  try {
    return new URL(process.env.BETTER_AUTH_URL).origin;
  } catch {
    return undefined;
  }
})();
const configuredLocalNetworkOrigin = (() => {
  if (process.env.NODE_ENV !== "development" || !process.env.REVOK_LOCAL_NETWORK_ORIGIN) return undefined;
  try {
    const url = new URL(process.env.REVOK_LOCAL_NETWORK_ORIGIN);
    const host = url.hostname.toLowerCase();
    const octets = host.split(".").map(Number);
    const privateIpv4 = isIP(host) === 4 && (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254)
    );
    const privateIpv6 = isIP(host) === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"));
    const localName = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local");
    if (url.protocol !== "http:" || !(privateIpv4 || privateIpv6 || localName)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
})();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.NODE_ENV === "development"
    ? {
        allowedHosts: developmentHosts,
        fallback: configuredAuthOrigin ?? `http://localhost:${process.env.PORT ?? "3000"}`,
        protocol: "http",
      }
    : process.env.BETTER_AUTH_URL,

  trustedOrigins: (request) => {
    const requestOrigin = request ? new URL(request.url).origin : undefined;
    const requestUrl = request ? new URL(request.url) : undefined;
    const requestHostIsLocal = Boolean(requestUrl && developmentHosts.includes(requestUrl.hostname.toLowerCase()));
    const developmentOrigin = process.env.NODE_ENV === "development" && requestUrl?.protocol === "http:" && requestHostIsLocal
      ? requestOrigin
      : undefined;
    return [
      "http://localhost:3000",
      ...(configuredAuthOrigin ? [configuredAuthOrigin] : []),
      ...(configuredLocalNetworkOrigin ? [configuredLocalNetworkOrigin] : []),
      ...(developmentOrigin ? [developmentOrigin] : []),
    ];
  },

  rateLimit: {
    enabled: true,
    storage: "memory",
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-in/phone-number": { window: 60, max: 5 },
      "/phone-number/send-otp": { window: 60 * 60, max: 3 },
      "/phone-number/verify": { window: 15 * 60, max: 5 },
    },
  },

  account: {
    encryptOAuthTokens: true,
  },

  emailAndPassword: {
    enabled: true,
  },

  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
  ],

  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            prompt: "select_account",

            mapProfileToUser: () => ({}),
          },
        }
      : {},

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

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });

          if (!user || user.status === "BANNED" || user.status === "DELETED") {
            throw APIError.from("FORBIDDEN", {
              code: "ACCOUNT_UNAVAILABLE",
              message: "This account is not permitted to sign in.",
            });
          }

          await ensureConfiguredSuperAdmin(session.userId);
        },
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
      sendOTP: deliverPhoneOtp,

      phoneNumberValidator: (phoneNumber) => {
        const cleaned = phoneNumber.replace(/\s+/g, "");
        return /^(?:\+?91)?[6-9]\d{9}$/.test(cleaned);
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
