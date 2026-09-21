"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { describeAuthError, RECAPTCHA_CONTAINER_ID } from "@/lib/firebase/client";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "US/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, loginWithGoogle, requestPhoneOtp, verifyPhoneOtp, cancelPhoneOtp } = useAuth();

  const [mode, setMode] = useState<"google" | "phone">("google");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const cleanPhone = phone.replace(/\D/g, "");
  const e164Phone = `${countryCode}${cleanPhone}`;

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    setError(null);

    if (!cleanPhone || cleanPhone.length < 7) {
      setError("Please enter a valid mobile phone number.");
      return;
    }

    setBusy(true);
    try {
      await requestPhoneOtp(e164Phone);
      setStep("otp");
      setResendTimer(30);
      setOtp("");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void sendOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    setBusy(true);
    try {
      await verifyPhoneOtp(otp);
    } catch (err) {
      setError(describeAuthError(err));
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  const handleEditNumber = () => {
    cancelPhoneOtp();
    setStep("phone");
    setError(null);
    setOtp("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm sm:p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-normal">BNI Renewal CRM</h1>
          <p className="text-sm text-[var(--muted)]">Sign in to continue</p>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-[#eef1ea] px-3 py-2 text-xs text-[var(--muted)]">
          This is the same single sign-on used by the <strong>Handychapter</strong> app &mdash; one
          account works across both. If you&apos;ve already linked Google and phone together in
          Handychapter, either one will sign you in here too.
        </div>

        <div className="flex rounded-md border border-[var(--line)] p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("google");
              setError(null);
            }}
            className={`focus-ring flex-1 rounded-sm py-2 transition-colors ${
              mode === "google" ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--muted)]"
            }`}
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("phone");
              setError(null);
            }}
            className={`focus-ring flex-1 rounded-sm py-2 transition-colors ${
              mode === "phone" ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--muted)]"
            }`}
          >
            Phone
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-[var(--danger)] bg-[#fbeae7] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {mode === "google" ? (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white py-3 text-sm font-medium hover:bg-[#f3f4f1] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {busy ? "Signing in..." : "Sign in with Google"}
          </button>
        ) : step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--muted)]">Mobile phone number</label>
              <div className="flex overflow-hidden rounded-md border border-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="border-r border-[var(--line)] bg-[#f3f4f1] px-2 text-sm outline-none"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                  }}
                  placeholder="98765 43210"
                  className="w-full px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !cleanPhone}
              className="focus-ring w-full rounded-md bg-[var(--accent)] py-3 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Code sent to {countryCode} {cleanPhone}</span>
              <button type="button" onClick={handleEditNumber} className="focus-ring font-medium text-[var(--accent)]">
                Edit
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--muted)]">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="123456"
                autoFocus
                className="focus-ring w-full rounded-md border border-[var(--line)] px-3 py-2 text-center text-lg tracking-[0.4em] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy || otp.length < 6}
              className="focus-ring w-full rounded-md bg-[var(--accent)] py-3 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-50"
            >
              {busy ? "Verifying..." : "Verify and continue"}
            </button>

            <div className="text-center text-xs text-[var(--muted)]">
              {resendTimer > 0 ? (
                <span>Resend code in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={busy}
                  className="focus-ring font-medium text-[var(--accent)]"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        {/* Invisible reCAPTCHA mounts here; Firebase needs this element present before
            signInWithPhoneNumber runs, so it stays in the DOM across both steps. */}
        <div id={RECAPTCHA_CONTAINER_ID} />
      </div>
    </div>
  );
}
