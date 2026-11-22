export type OtpDeliveryInput = {
  phoneNumber: string;
  code: string;
};

const MSG91_SEND_URL = "https://control.msg91.com/api/v5/otp";
const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify";
const DEFAULT_OTP_LENGTH = 4;
const DEFAULT_OTP_EXPIRY_MINUTES = 5;

export function getOtpProviderConfig() {
  const authKey = process.env.MSG91_AUTH_KEY?.trim() ?? "";
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID?.trim() ?? "";
  const rawOtpLength = Number(process.env.MSG91_OTP_LENGTH ?? DEFAULT_OTP_LENGTH);
  const rawOtpExpiryMinutes = Number(process.env.MSG91_OTP_EXPIRY_MINUTES ?? DEFAULT_OTP_EXPIRY_MINUTES);
  const otpLength = DEFAULT_OTP_LENGTH;
  const otpExpiryMinutes = Number.isInteger(rawOtpExpiryMinutes) && rawOtpExpiryMinutes >= 1 && rawOtpExpiryMinutes <= 10080 ? rawOtpExpiryMinutes : DEFAULT_OTP_EXPIRY_MINUTES;
  const enabled = process.env.MSG91_ENABLED === "true";
  const valid = Boolean(authKey && templateId && rawOtpLength === DEFAULT_OTP_LENGTH && rawOtpExpiryMinutes === otpExpiryMinutes);
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
  if (!/^\d{4}$/.test(code)) throw new Error("Verification code must contain exactly 4 digits.");
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
  if (!/^\d{4}$/.test(code)) return false;
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

const MSG91_WIDGET_VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

export async function verifyWidgetAccessToken(accessToken: string): Promise<{
  success: boolean;
  mobile?: string;
  error?: string;
}> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    throw new Error("MSG91 AuthKey is not configured.");
  }
  if (!accessToken || typeof accessToken !== "string") {
    return { success: false, error: "Access token is required." };
  }

  let response: Response;
  try {
    response = await fetch(MSG91_WIDGET_VERIFY_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        authkey: authKey,
        "access-token": accessToken.trim(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("The SMS verification service is temporarily unavailable.");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failure with SMS provider.");
    }
    return { success: false, error: "Verification token could not be verified." };
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Malformed response from verification service." };
  }

  if (!body) {
    return { success: false, error: "Empty response from verification service." };
  }

  // Strictly check official MSG91 response schema: { type: "success", message: "91XXXXXXXXXX" }
  if (body.type !== "success" || typeof body.message !== "string") {
    const errorMsg = typeof body.message === "string" ? body.message : "Token verification failed.";
    return { success: false, error: errorMsg };
  }

  const rawMessage = body.message.trim();

  // Strictly validate Indian mobile number: must begin with 91 followed by valid 10-digit mobile
  if (!/^91[6-9]\d{9}$/.test(rawMessage)) {
    return { success: false, error: "Invalid mobile number received from provider." };
  }

  const national = rawMessage.slice(2);
  return { success: true, mobile: national };
}

export function getMsg91WidgetId(): string {
  return (
    process.env.MSG91_WIDGET_ID?.trim() ||
    process.env.NEXT_PUBLIC_MSG91_WIDGET_ID?.trim() ||
    "366b67695879383238353332"
  );
}

const MSG91_WIDGET_SEND_URL = "https://control.msg91.com/api/v5/widget/sendOtp";
const MSG91_WIDGET_VERIFY_OTP_URL = "https://control.msg91.com/api/v5/widget/verifyOtp";
const MSG91_WIDGET_RETRY_OTP_URL = "https://control.msg91.com/api/v5/widget/retryOtp";

export async function sendWidgetOtpServer(params: {
  phoneNumber: string;
  widgetId?: string;
}): Promise<{
  success: boolean;
  reqId?: string;
  error?: string;
}> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    throw new Error("Phone verification is temporarily unavailable. Please try again later.");
  }

  const widgetId = params.widgetId || getMsg91WidgetId();
  const digits = params.phoneNumber.replace(/\D/g, "");
  const national = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(national)) {
    return { success: false, error: "Invalid phone number." };
  }
  const identifier = `91${national}`;

  let response: Response;
  try {
    response = await fetch(MSG91_WIDGET_SEND_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        authkey: authKey,
        widgetId,
        identifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("The SMS verification service is temporarily unavailable.");
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON or empty response
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failure with SMS provider.");
    }
    const errorMsg = typeof body?.message === "string" ? body.message : "Failed to send verification code.";
    return { success: false, error: errorMsg };
  }

  if (!body || typeof body !== "object") {
    return { success: false, error: "Empty response from verification service." };
  }

  // Strictly check official MSG91 success response:
  // Must have type === "success" AND a non-empty string reqId.
  // Never fallback to body.message as reqId.
  // If type is "error" or not "success", treat as failure even if HTTP status was 200.
  if (
    body.type === "success" &&
    typeof body.reqId === "string" &&
    body.reqId.trim().length > 0
  ) {
    return { success: true, reqId: body.reqId.trim() };
  }

  const errorMsg =
    typeof body.message === "string" && body.message.trim().length > 0
      ? body.message.trim()
      : "The verification service reported an error.";
  return { success: false, error: errorMsg };
}

export async function verifyWidgetOtpServer(params: {
  otp: string;
  reqId?: string;
  widgetId?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    throw new Error("Phone verification is temporarily unavailable. Please try again later.");
  }

  const widgetId = params.widgetId || getMsg91WidgetId();
  const trimmedOtp = params.otp.trim();
  if (!/^\d{4}$/.test(trimmedOtp)) {
    return { success: false, error: "Invalid verification code format." };
  }
  if (!params.reqId || typeof params.reqId !== "string" || params.reqId.trim().length === 0) {
    return { success: false, error: "Invalid or missing verification session." };
  }

  let response: Response;
  try {
    response = await fetch(MSG91_WIDGET_VERIFY_OTP_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        authkey: authKey,
        widgetId,
        reqId: params.reqId.trim(),
        otp: trimmedOtp,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("The SMS verification service is temporarily unavailable.");
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Malformed response from verification service." };
  }

  if (!response.ok || !body || typeof body !== "object") {
    const errorMsg = typeof body?.message === "string" ? body.message : "Verification code could not be validated.";
    return { success: false, error: errorMsg };
  }

  // Strictly check type === "success". Any other type (including type: "error" with HTTP 200) is failure.
  if (body.type === "success") {
    return { success: true };
  }

  const errorMsg =
    typeof body.message === "string" && body.message.trim().length > 0
      ? body.message.trim()
      : "Invalid or expired verification code.";
  return { success: false, error: errorMsg };
}

export async function retryWidgetOtpServer(params: {
  reqId?: string;
  widgetId?: string;
  channel?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    throw new Error("Phone verification is temporarily unavailable. Please try again later.");
  }

  const widgetId = params.widgetId || getMsg91WidgetId();
  if (!params.reqId || typeof params.reqId !== "string" || params.reqId.trim().length === 0) {
    return { success: false, error: "Invalid or missing verification session." };
  }

  let response: Response;
  try {
    response = await fetch(MSG91_WIDGET_RETRY_OTP_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        authkey: authKey,
        widgetId,
        reqId: params.reqId.trim(),
        ...(params.channel ? { retryChannel: params.channel } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("The SMS verification service is temporarily unavailable.");
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Malformed response from verification service." };
  }

  if (!response.ok || !body || typeof body !== "object") {
    const errorMsg = typeof body?.message === "string" ? body.message : "Failed to resend verification code.";
    return { success: false, error: errorMsg };
  }

  if (body.type !== "success") {
    const errorMsg =
      typeof body.message === "string" && body.message.trim().length > 0
        ? body.message.trim()
        : "Failed to resend verification code.";
    return { success: false, error: errorMsg };
  }

  return { success: true };
}
