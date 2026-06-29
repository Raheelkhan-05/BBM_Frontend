// frontend/Login.jsx — OTP login with client-side validation

import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { sendOtp, verifyOtp } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const PIPELINE = [
  { label: "Prospect", desc: "Identify early interest" },
  { label: "Lead",     desc: "Qualify the opportunity" },
  { label: "Enquiry",  desc: "Capture the requirement" },
  { label: "Sample",   desc: "Evaluate the product"    },
  { label: "Order",    desc: "Close the deal"          },
];

// ── Validation ────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validateEmail = (v) => {
  if (!v.trim())           return "Email address is required.";
  if (!EMAIL_RE.test(v))   return "Please enter a valid email address.";
  return null;
};

// ── OTP digit boxes ───────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled, hasError }) {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);
  const focus = (i) => refs[i]?.current?.focus();

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      onChange(digits.map((d, idx) => (idx === i ? "" : d)).join(""));
      if (i > 0) focus(i - 1);
      return;
    }
    if (e.key === "ArrowLeft"  && i > 0) { e.preventDefault(); focus(i - 1); }
    if (e.key === "ArrowRight" && i < 5) { e.preventDefault(); focus(i + 1); }
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    if (raw.length >= 6) { onChange(raw.slice(0, 6)); focus(5); return; }
    onChange(digits.map((d, idx) => (idx === i ? raw[raw.length - 1] : d)).join(""));
    if (i < 5) focus(i + 1);
  };

  const handlePaste = (e) => {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (p) { e.preventDefault(); onChange(p); focus(Math.min(p.length, 5)); }
  };

  return (
    <div className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className={`
            h-12 w-full rounded-xl border text-center text-lg font-bold text-slate-900
            outline-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
            ${hasError
              ? "border-rose-400 bg-rose-50 ring-2 ring-rose-100"
              : d
                ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100"
                : "border-slate-200 bg-slate-50/70 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 hover:border-slate-300"
            }
          `}
        />
      ))}
    </div>
  );
}

function useCountdown(initial = 60) {
  const [seconds, setSeconds] = useState(0);
  const start = () => setSeconds(initial);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return { seconds, start };
}

// ── Shared alert components ───────────────────────────────────────────────
function ErrorBanner({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3"
    >
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-sm font-medium text-rose-600">{msg}</p>
    </motion.div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 text-xs font-medium text-rose-500 flex items-center gap-1"
    >
      <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </motion.p>
  );
}

// ═════════════════════════════════════════════════════════════════════════
export default function Login() {
  const [step, setStep]       = useState("email");
  const [email, setEmail]     = useState("");
  const [otp, setOtp]         = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});   // { email: "…" }
  const [otpError, setOtpError]       = useState("");   // shown under boxes

  const { login } = useAuth();
  const navigate  = useNavigate();
  const { seconds, start: startCountdown } = useCountdown(60);

  // ── Field blur validation ─────────────────────────────────────────────
  const blurEmail = () => {
    const err = validateEmail(email);
    setFieldErrors((f) => ({ ...f, email: err }));
  };

  // ── Step 1: send OTP ──────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      return;
    }
    setFieldErrors({});
    setApiError("");
    setLoading(true);
    try {
      await sendOtp(email);
      setStep("otp");
      startCountdown();
    } catch (err) {
      setApiError(err.response?.data?.message || "Could not send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────
  const handleVerify = async () => {
    if (otp.replace(/\s/g, "").length < 6) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    setOtpError("");
    setApiError("");
    setLoading(true);
    try {
      const data = await verifyOtp(email, otp.replace(/\s/g, ""));
      login(data.user, data.token);
      navigate("/prospects");
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid or expired code.";
      setOtpError(msg);
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit on 6 digits
  useEffect(() => {
    if (step === "otp" && otp.replace(/\s/g, "").length === 6) handleVerify();
  }, [otp]);

  const handleResend = async () => {
    if (seconds > 0) return;
    setOtpError("");
    setOtp("");
    setLoading(true);
    try {
      await sendOtp(email);
      startCountdown();
    } catch (err) {
      setApiError(err.response?.data?.message || "Could not resend code.");
    } finally {
      setLoading(false);
    }
  };

  const emailBorder = fieldErrors.email
    ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100"
    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 hover:border-slate-300";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-slate-50">

      {/* ══ LEFT BRAND PANEL ═══════════════════════════════════ */}
      <div className="relative hidden overflow-hidden bg-indigo-950 lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:px-10 lg:py-12 xl:w-[42%] xl:px-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="absolute -bottom-20 left-0 h-60 w-60 rounded-full bg-violet-600/25 blur-3xl" />
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots-l" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="white" fillOpacity="0.07" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots-l)" />
          </svg>
        </div>

        <div className="relative space-y-10 mt-10 ms-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-indigo-300">Full Pipeline Visibility</p>
            <h2 className="text-3xl font-extrabold leading-[1.15] text-white xl:text-4xl">Every deal.<br />One place.</h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-indigo-200">
              Track every opportunity from first contact to closed order — no spreadsheets, no missed follow-ups.
            </p>
          </motion.div>
          <div className="relative">
            {PIPELINE.map((stage, i) => (
              <motion.div key={stage.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }} className="flex items-stretch gap-4">
                <div className="flex w-4 flex-col items-center">
                  <div className={`w-px flex-1 ${i === 0 ? "opacity-0" : "bg-indigo-500"}`} />
                  <div className={`my-1 flex-shrink-0 rounded-full ${i === 0 ? "h-3 w-3 bg-indigo-300 ring-2 ring-indigo-300/50 shadow-[0_0_8px_2px_rgba(165,180,252,0.4)]" : "h-2 w-2 bg-indigo-500 ring-1 ring-indigo-400/60"}`} />
                  <div className={`w-px flex-1 ${i === PIPELINE.length - 1 ? "opacity-0" : "bg-indigo-500"}`} />
                </div>
                <div className="flex flex-col justify-center py-3">
                  <p className={`text-[13px] font-semibold ${i === 0 ? "text-white" : "text-indigo-200"}`}>{stage.label}</p>
                  <p className="text-[11px] text-indigo-400">{stage.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="relative text-[11px] text-indigo-500 ms-10">
          © {new Date().getFullYear()} BBM · Built for teams who move fast
        </motion.p>
      </div>

      {/* ══ RIGHT FORM PANEL ═══════════════════════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-10">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm">

          {/* Mobile badge */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="mb-8 flex justify-center lg:hidden">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-600 shadow-sm">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              Brand Brigade Marketing
            </span>
          </motion.div>

          {/* Heading */}
          <AnimatePresence mode="wait">
            {step === "email" ? (
              <motion.div key="h-email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mb-7 text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Welcome back</h1>
                <p className="mt-1.5 text-sm text-slate-500">Enter your email to receive a sign-in code.</p>
              </motion.div>
            ) : (
              <motion.div key="h-otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mb-7 text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                  <svg className="h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Check your inbox</h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  We sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-[0_2px_16px_0_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03] sm:px-7">
            <AnimatePresence mode="wait">

              {/* Email step */}
              {step === "email" && (
                <motion.div key="email-form" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
                  <div className="mb-5">
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Email address
                    </label>
                    <div className="relative">
                      <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors({}); }}
                        onBlur={blurEmail}
                        onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                        autoComplete="email"
                        autoFocus
                        className={`w-full rounded-xl border bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:bg-white focus:ring-3 ${emailBorder}`}
                      />
                    </div>
                    <FieldError msg={fieldErrors.email} />
                  </div>

                  {apiError && <ErrorBanner msg={apiError} />}

                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !email.trim()}
                    className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
                        Sending code…
                      </span>
                    ) : "Send sign-in code →"}
                  </button>
                </motion.div>
              )}

              {/* OTP step */}
              {step === "otp" && (
                <motion.div key="otp-form" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
                  <div className="mb-1">
                    <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      6-digit code
                    </label>
                    <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(""); }} disabled={loading} hasError={!!otpError} />
                  </div>

                  {otpError && (
                    <motion.p initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="mt-2 mb-1 text-xs font-medium text-rose-500 flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {otpError}
                    </motion.p>
                  )}

                  {apiError && <ErrorBanner msg={apiError} />}

                  <button
                    onClick={handleVerify}
                    disabled={loading || otp.length < 6}
                    className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
                        Verifying…
                      </span>
                    ) : "Verify & sign in →"}
                  </button>

                  <div className="mt-4 flex items-center justify-between text-[13px]">
                    <button onClick={() => { setStep("email"); setOtp(""); setApiError(""); setOtpError(""); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                      ← Change email
                    </button>
                    <button onClick={handleResend} disabled={seconds > 0 || loading} className="font-semibold text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline transition-colors">
                      {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/signup" className="font-bold text-indigo-600 hover:underline">Create one</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}