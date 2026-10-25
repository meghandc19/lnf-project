export type OtpDeliveryInput = {
  phoneNumber: string;
  code: string;
};

type DevelopmentOtpOptions = {
  nodeEnv: string | undefined;
  enabled: boolean;
  writeLine?: (message: string) => void;
};

function maskPhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  return `••••${digits.slice(-4)}`;
}

export function assertDevelopmentOtpMode(
  nodeEnv: string | undefined,
  enabled: boolean,
) {
  if (enabled && nodeEnv !== "development") {
    throw new Error(
      "REVOK_DEV_OTP_TERMINAL may only be enabled in local development.",
    );
  }
}

export function createOtpDelivery(options: DevelopmentOtpOptions) {
  assertDevelopmentOtpMode(options.nodeEnv, options.enabled);

  return async ({ phoneNumber, code }: OtpDeliveryInput) => {
    if (options.nodeEnv !== "development" || !options.enabled) {
      throw new Error(
        "OTP delivery is disabled. Enable REVOK_DEV_OTP_TERMINAL in local development.",
      );
    }

    const writeLine = options.writeLine ?? console.info;
    writeLine(
      `[REVOK local development only] OTP for ${maskPhoneNumber(phoneNumber)}: ${code}`,
    );
  };
}

export const deliverPhoneOtp = createOtpDelivery({
  nodeEnv: process.env.NODE_ENV,
  enabled: process.env.REVOK_DEV_OTP_TERMINAL === "true",
});
