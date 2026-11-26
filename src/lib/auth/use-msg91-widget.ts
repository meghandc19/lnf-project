"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (
      identifier: string,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string,
    ) => void;
    verifyOtp?: (
      otp: string,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string,
    ) => void;
  }
}

const MSG91_WIDGET_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";
const DEFAULT_MSG91_WIDGET_ID = "366b67695879383238353332";

export function extractMsg91AccessToken(data: unknown): string | null {
  if (typeof data === "string" && data.startsWith("ey")) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["token", "accessToken", "access-token", "message"]) {
      if (typeof obj[key] === "string" && (obj[key] as string).startsWith("ey")) {
        return obj[key] as string;
      }
    }
  }
  return null;
}

function getWidgetErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

type WidgetCallbacks = {
  onInitError?: (message: string) => void;
};

export function useMsg91OtpWidget(options?: WidgetCallbacks) {
  const [widgetReady, setWidgetReady] = useState(false);
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH?.trim() || "";
  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID?.trim() || DEFAULT_MSG91_WIDGET_ID;
  const isConfigured = Boolean(tokenAuth);

  const onInitErrorRef = useRef(options?.onInitError);
  useEffect(() => {
    onInitErrorRef.current = options?.onInitError;
  }, [options?.onInitError]);

  const pendingVerifyResolveRef = useRef<((result: { ok: true; accessToken: string } | { ok: false; error: string }) => void) | null>(null);

  const initializeWidget = useCallback(() => {
    if (!window.initSendOTP) {
      onInitErrorRef.current?.(
        "MSG91 phone verification could not initialize. Check the widget configuration and allowed domain.",
      );
      return;
    }

    try {
      window.initSendOTP({
        widgetId,
        tokenAuth,
        exposeMethods: true,
        success: (data: unknown) => {
          const resolver = pendingVerifyResolveRef.current;
          if (!resolver) return;
          pendingVerifyResolveRef.current = null;
          const token = extractMsg91AccessToken(data);
          if (token) {
            resolver({ ok: true, accessToken: token });
          } else {
            resolver({ ok: false, error: "MSG91 could not confirm this number. Please verify it again." });
          }
        },
        failure: (error: unknown) => {
          const resolver = pendingVerifyResolveRef.current;
          if (!resolver) return;
          pendingVerifyResolveRef.current = null;
          resolver({
            ok: false,
            error: getWidgetErrorMessage(
              error,
              "MSG91 could not complete phone verification. Check your number and try again.",
            ),
          });
        },
      });
      setWidgetReady(true);
    } catch {
      onInitErrorRef.current?.(
        "MSG91 could not start phone verification. Refresh the page and try again.",
      );
    }
  }, [tokenAuth, widgetId]);

  useEffect(() => {
    if (!tokenAuth) return;

    let cancelled = false;
    if (window.initSendOTP) {
      queueMicrotask(() => {
        if (!cancelled) initializeWidget();
      });
      return () => {
        cancelled = true;
        pendingVerifyResolveRef.current = null;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${MSG91_WIDGET_SCRIPT_URL}"]`,
    );
    if (existingScript) {
      const handleLoad = () => {
        if (!cancelled) initializeWidget();
      };
      const handleError = () => {
        if (!cancelled) {
          onInitErrorRef.current?.(
            "Could not load MSG91 phone verification. Check your connection and try again.",
          );
        }
      };
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
        pendingVerifyResolveRef.current = null;
      };
    }

    const script = document.createElement("script");
    script.src = MSG91_WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (!cancelled) initializeWidget();
    };
    script.onerror = () => {
      if (!cancelled) {
        onInitErrorRef.current?.(
          "Could not load MSG91 phone verification. Check your connection and try again.",
        );
      }
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      pendingVerifyResolveRef.current = null;
    };
  }, [initializeWidget, tokenAuth]);

  const sendWidgetOtp = useCallback(
    (normalizedPhone: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!isConfigured) {
        return Promise.resolve({
          ok: false,
          error: "Phone verification is unavailable because the MSG91 browser configuration is missing.",
        });
      }
      if (!widgetReady || !window.sendOtp) {
        return Promise.resolve({
          ok: false,
          error: "MSG91 phone verification is still loading or unavailable. Refresh the page and try again.",
        });
      }

      const digits = normalizedPhone.replace(/\D/g, "");
      const identifier = digits.startsWith("91") ? digits : `91${digits}`;

      return new Promise((resolve) => {
        window.sendOtp?.(
          identifier,
          () => resolve({ ok: true }),
          (error: unknown) =>
            resolve({
              ok: false,
              error: getWidgetErrorMessage(error, "SMS delivery failed. Check the number and try again."),
            }),
        );
      });
    },
    [isConfigured, widgetReady],
  );

  const verifyWidgetOtp = useCallback(
    (otp: string): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> => {
      if (!widgetReady || !window.verifyOtp) {
        return Promise.resolve({
          ok: false,
          error: "MSG91 phone verification is unavailable. Refresh the page and try again.",
        });
      }

      return new Promise((resolve) => {
        pendingVerifyResolveRef.current = resolve;
        window.verifyOtp?.(
          otp,
          (data: unknown) => {
            const resolver = pendingVerifyResolveRef.current;
            if (!resolver) return;
            pendingVerifyResolveRef.current = null;
            const token = extractMsg91AccessToken(data);
            if (token) {
              resolver({ ok: true, accessToken: token });
            } else {
              resolver({ ok: false, error: "Verification failed. Please request a new code." });
            }
          },
          (error: unknown) => {
            const resolver = pendingVerifyResolveRef.current;
            if (!resolver) return;
            pendingVerifyResolveRef.current = null;
            resolver({
              ok: false,
              error: getWidgetErrorMessage(error, "Invalid or expired code. Please try again."),
            });
          },
        );
      });
    },
    [widgetReady],
  );

  const retryWidgetOtp = useCallback(
    (channel: string | null = null): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!widgetReady || !window.retryOtp) {
        return Promise.resolve({
          ok: false,
          error: "MSG91 phone verification is unavailable. Refresh the page and try again.",
        });
      }

      return new Promise((resolve) => {
        window.retryOtp?.(
          channel,
          () => resolve({ ok: true }),
          (error: unknown) =>
            resolve({
              ok: false,
              error: getWidgetErrorMessage(error, "Could not resend the code. Please try again later."),
            }),
        );
      });
    },
    [widgetReady],
  );

  return {
    isConfigured,
    widgetReady,
    sendWidgetOtp,
    verifyWidgetOtp,
    retryWidgetOtp,
  };
}
