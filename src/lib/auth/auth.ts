import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber, username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

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
      usernameValidator: (username) => {
        return /^[a-zA-Z0-9_.]+$/.test(username);
      },
    }),

    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        console.log(`OTP for ${phoneNumber}: ${code}`);
      },

      requireVerification: true,

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