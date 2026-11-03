export type OtpDeliveryInput = {
  phoneNumber: string;
  code: string;
};

const MSG91_SEND_URL = "https://control.msg91.com/api/v5/otp";
const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify";
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRY_MINUTES = 5;

export function getOtpProviderConfig() {
  const authKey = process.env.MSG91_AUTH_KEY?.trim() ?? "";
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID?.trim() ?? "";
  const rawOtpLength = Number(process.env.MSG91_OTP_LENGTH ?? DEFAULT_OTP_LENGTH);
  const rawOtpExpiryMinutes = Number(process.env.MSG91_OTP_EXPIRY_MINUTES ?? DEFAULT_OTP_EXPIRY_MINUTES);
  const otpLength = Number.isInteger(rawOtpLength) ? rawOtpLength : DEFAULT_OTP_LENGTH;
  const otpExpiryMinutes = Number.isInteger(rawOtpExpiryMinutes) && rawOtpExpiryMinutes >= 1 && rawOtpExpiryMinutes <= 10080 ? rawOtpExpiryMinutes : DEFAULT_OTP_EXPIRY_MINUTES;
  const enabled = process.env.MSG91_ENABLED === "true";
  const valid = Boolean(authKey && templateId && rawOtpLength === 6 && rawOtpExpiryMinutes === otpExpiryMinutes);
  return { configured: valid, enabled: enabled && valid, otpLength, otpExpiryMinutes };
}

function credentials() {
  const config = getOtpProviderConfig();
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID?.trim();
  if (!config.enabled || !authKey || !templateId) throw new Error("Phone verification is temporarily unavailable. Please try again later.");
  return { authKey, templateId, otpLength: config.otpLength, otpExpiryMinutes: config.otpExpiryMinutes };
}

function msg91PhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  const national = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(national)) throw new Error("Invalid phone number.");
  return `91${national}`;
}

async function providerJson(response: Response): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  if (!response.ok || !body || typeof body !== "object" || (body as { type?: unknown }).type !== "success") {
    throw new Error("The SMS verification service could not complete the request.");
  }
  return body as Record<string, unknown>;
}

export async function sendMsg91Otp({ phoneNumber, code }: OtpDeliveryInput) {
  const config = credentials();
  const url = new URL(MSG91_SEND_URL);
  url.searchParams.set("template_id", config.templateId);
  url.searchParams.set("mobile", msg91PhoneNumber(phoneNumber));
  url.searchParams.set("otp", code);
  url.searchParams.set("otp_length", String(config.otpLength));
  url.searchParams.set("otp_expiry", String(config.otpExpiryMinutes));
  const response = await fetch(url, {
    method: "POST",
    headers: { authkey: config.authKey, "content-type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  await providerJson(response);
}

export async function verifyMsg91Otp({ phoneNumber, code }: OtpDeliveryInput) {
  const config = credentials();
  const url = new URL(MSG91_VERIFY_URL);
  url.searchParams.set("mobile", msg91PhoneNumber(phoneNumber));
  url.searchParams.set("otp", code);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { authkey: config.authKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("The SMS verification service is temporarily unavailable.");
  }
  if (!response.ok) throw new Error("The SMS verification service is temporarily unavailable.");
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error("The SMS verification service is temporarily unavailable."); }
  if (!body || typeof body !== "object" || typeof (body as { type?: unknown }).type !== "string") {
    throw new Error("The SMS verification service is temporarily unavailable.");
  }
  return (body as { type: string }).type === "success";
}

export const deliverPhoneOtp = sendMsg91Otp;
