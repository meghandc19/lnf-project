export type OtpDeliveryInput = {
  phoneNumber: string;
  code: string;
};

type OtpDeliveryOptions = {
  nodeEnv: string | undefined;
};

type LocalCode = { code: string; expiresAt: number };
const localCodes = new Map<string, LocalCode>();
const LOCAL_CODE_TTL_MS = 5 * 60 * 1000;

function phoneKey(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

export function takeDevelopmentOtp(phoneNumber: string) {
  const key = phoneKey(phoneNumber);
  const entry = localCodes.get(key);
  localCodes.delete(key);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.code;
}

export function createOtpDelivery(options: OtpDeliveryOptions) {
  return async ({ phoneNumber, code }: OtpDeliveryInput) => {
    if (options.nodeEnv === "development") {
      if (localCodes.size > 1_000) {
        const now = Date.now();
        for (const [key, entry] of localCodes) if (entry.expiresAt <= now) localCodes.delete(key);
      }
      localCodes.set(phoneKey(phoneNumber), { code, expiresAt: Date.now() + LOCAL_CODE_TTL_MS });
      return;
    }

    throw new Error("SMS delivery is not configured. Add MSG91 credentials when the provider integration is ready.");
  };
}

export const deliverPhoneOtp = createOtpDelivery({ nodeEnv: process.env.NODE_ENV });
