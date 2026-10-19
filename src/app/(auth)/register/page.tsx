"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import {
  indianPhoneSchema,
  normalizeIndianPhone,
} from "@/lib/validation/common";

export default function RegisterPage() {
  const [step, setStep] = useState<"phone" | "otp" | "details">("phone");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function sendOtp() {
    setLoading(true);
    setMessage("");

    const validation = indianPhoneSchema.safeParse(phoneNumber);

    if (!validation.success) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      setLoading(false);
      return;
    }

    const normalizedPhone = normalizeIndianPhone(phoneNumber);

    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: normalizedPhone,
      });

      if (result.error) {
        setMessage(result.error.message || "Failed to send OTP.");
        return;
      }

      setPhoneNumber(normalizedPhone);
      setStep("otp");
      setMessage("OTP sent. Check the terminal for the development OTP.");
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setMessage("");

    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber,
        code: otp,
      });

      if (result.error) {
        setMessage(result.error.message || "Invalid OTP.");
        return;
      }

      setStep("details");
      setMessage("Phone verified successfully.");
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function finishSignup() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/account/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message || "Could not create your account.");
        return;
      }

      setMessage("Account created successfully.");

      window.location.href = "/dashboard";
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900">
      <div className="mx-auto flex min-h-[90vh] w-full max-w-md items-center">
        <div className="w-full rounded-2xl border border-gray-300 bg-white p-6 shadow-md sm:p-8">
          
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-green-700">
              REVOK
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Create your account
            </p>
          </div>

          {step === "phone" && (
            <section>
              <h2 className="mb-5 text-xl font-semibold">
                Verify your phone
              </h2>

              <label className="mb-2 block text-sm font-medium">
                Phone number
              </label>

              <input
                type="tel"
                inputMode="numeric"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="9876543210 or +91 9876543210"
                className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-green-600"
              />

              <button
                type="button"
                onClick={sendOtp}
                disabled={loading || !phoneNumber}
                className="mt-5 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </section>
          )}

          {step === "otp" && (
            <section>
              <h2 className="mb-2 text-xl font-semibold">
                Enter OTP
              </h2>

              <p className="mb-5 text-sm text-gray-600">
                OTP sent to {phoneNumber}
              </p>

              <label className="mb-2 block text-sm font-medium">
                OTP
              </label>

              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, ""))
                }
                maxLength={6}
                placeholder="123456"
                className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-center text-xl tracking-[0.4em] text-gray-900 outline-none focus:border-green-600"
              />

              <button
                type="button"
                onClick={verifyOtp}
                disabled={loading || otp.length < 4}
                className="mt-5 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setMessage("");
                }}
                className="mt-3 w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 font-medium text-gray-800"
              >
                Change phone number
              </button>
            </section>
          )}

          {step === "details" && (
            <section>
              <h2 className="mb-5 text-xl font-semibold">
                Complete your account
              </h2>

              <label className="mb-2 block text-sm font-medium">
                Name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mb-4 w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
              />

              <label className="mb-2 block text-sm font-medium">
                Username
              </label>

              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="mb-4 w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
              />

              <label className="mb-2 block text-sm font-medium">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-green-600"
              />

              <button
                type="button"
                onClick={finishSignup}
                disabled={loading || !name || !username || password.length < 8}
                className="mt-5 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </section>
          )}

          {message && (
            <div className="mt-5 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-800">
              {message}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}