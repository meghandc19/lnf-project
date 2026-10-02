export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const unauthorized = () =>
  new ApiError(
    401,
    "UNAUTHORIZED",
    "You must be logged in.",
  );

export const forbidden = () =>
  new ApiError(
    403,
    "FORBIDDEN",
    "You do not have permission to perform this action.",
  );

export const phoneVerificationRequired = () =>
  new ApiError(
    403,
    "PHONE_VERIFICATION_REQUIRED",
    "Verify your phone number before performing this action.",
  );