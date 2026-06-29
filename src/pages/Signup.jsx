// frontend/Signup.jsx — OTP signup with full client-side validation

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { signupUser, verifyOtp, sendOtp } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { icon: "pipeline", title: "Full pipeline tracking",  desc: "Prospect → Lead → Enquiry → Order"  },
  { icon: "followup", title: "Never miss a follow-up",  desc: "Smart dates with overdue alerts"     },
  { icon: "team",     title: "Built for teams",         desc: "Role-based access for every member"  },
  { icon: "reports",  title: "Instant visibility",      desc: "Your whole pipeline at a glance"     },
];

function FeatureIcon({ icon }) {
  const cls = "h-4 w-4 text-indigo-200";
  if (icon === "pipeline") return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
  if (icon === "followup") return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (icon === "team") return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

// ── Validation rules ──────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+]?[\d\s\-().]{7,15}$/;
const NAME_RE  = /^[a-zA-Z]+$/;   // letters only — A-Z and a-z, no spaces/hyphens

// Strip any non-alpha character while typing into a name field
const filterName = (v) => v.replace(/[^a-zA-Z]/g, "");

const validators = {
  first_name: (v) => {
    if (!v.trim())             return "First name is required.";
    if (v.trim().length < 2)   return "First name must be at least 2 characters.";
    if (v.trim().length > 50)  return "First name must be under 50 characters.";
    if (!NAME_RE.test(v.trim())) return "First name can only contain letters A–Z.";
    return null;
  },
  last_name: (v) => {
    if (!v.trim())             return "Last name is required.";
    if (v.trim().length < 2)   return "Last name must be at least 2 characters.";
    if (v.trim().length > 50)  return "Last name must be under 50 characters.";
    if (!NAME_RE.test(v.trim())) return "Last name can only contain letters A–Z.";
    return null;
  },
  email: (v) => {
    if (!v.trim())         return "Email address is required.";
    if (!EMAIL_RE.test(v)) return "Please enter a valid email address.";
    return null;
  },
  phone: (v) => {
    if (!v.trim()) return null; // optional
    if (!PHONE_RE.test(v.trim())) return "Please enter a valid phone number (e.g. +91 98765 43210).";
    return null;
  },
};

const validateAll = (form) => {
  const errs = {};
  Object.keys(validators).forEach((k) => {
    const err = validators[k](form[k] || "");
    if (err) errs[k] = err;
  });
  return errs;
};

// ── OTP boxes ─────────────────────────────────────────────────────────────
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
          key={i} ref={refs[i]}
          type="text" inputMode="numeric" maxLength={6}
          value={d} disabled={disabled}
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

// ── Shared UI atoms ───────────────────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <motion.p initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs font-medium text-rose-500 flex items-center gap-1">
      <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </motion.p>
  );
}

function ErrorBanner({ msg }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3">
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-sm font-medium text-rose-600">{msg}</p>
    </motion.div>
  );
}

// Compute field border class
const fieldBorder = (err) =>
  err
    ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100"
    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 hover:border-slate-300";

const inputCls = (err) =>
  `w-full rounded-xl border bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:bg-white focus:ring-3 ${fieldBorder(err)}`;

// ── Icons ─────────────────────────────────────────────────────────────────
const EmailIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const PersonIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const PhoneIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .99h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
);

// ═════════════════════════════════════════════════════════════════════════
export default function Signup() {
  const [step, setStep] = useState("form"); // "form" | "otp" | "pending"

  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [fieldErrors, setFieldErrors]   = useState({});
  const [touched, setTouched]           = useState({});  // tracks blurred fields
  const [apiError, setApiError]         = useState("");
  const [otp, setOtp]                   = useState("");
  const [otpError, setOtpError]         = useState("");
  const [loading, setLoading]           = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const { seconds, start: startCountdown } = useCountdown(60);

  const set = (key) => (e) => {
    // Strip non-alpha characters live for name fields
    const raw = e.target.value;
    const val = (key === "first_name" || key === "last_name") ? filterName(raw) : raw;
    setForm((f) => ({ ...f, [key]: val }));
    // Re-validate on change if field was already touched
    if (touched[key]) {
      const err = validators[key](val);
      setFieldErrors((fe) => ({ ...fe, [key]: err }));
    }
  };

  const blur = (key) => () => {
    setTouched((t) => ({ ...t, [key]: true }));
    const err = validators[key](form[key] || "");
    setFieldErrors((fe) => ({ ...fe, [key]: err }));
  };

  // ── Step 1: submit ────────────────────────────────────────────────────
  const handleSignup = async () => {
    // Mark all fields touched and validate
    const allTouched = { first_name: true, last_name: true, email: true, phone: true };
    setTouched(allTouched);
    const errs = validateAll(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setApiError("");
    setLoading(true);
    try {
      await signupUser(form);
      setStep("otp");
      startCountdown();
    } catch (err) {
      setApiError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────
  const handleVerify = async () => {
    if (otp.replace(/\s/g, "").length < 6) { setOtpError("Please enter all 6 digits."); return; }
    setOtpError("");
    setApiError("");
    setLoading(true);
    try {
      const data = await verifyOtp(form.email, otp.replace(/\s/g, ""));
      login(data.user, data.token);
      navigate("/prospects");
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (err.response?.status === 403 || msg.toLowerCase().includes("pending")) {
        setStep("pending");
      } else {
        setOtpError(msg || "Invalid or expired code. Please try again.");
        setOtp("");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === "otp" && otp.replace(/\s/g, "").length === 6) handleVerify();
  }, [otp]);

  const handleResend = async () => {
    if (seconds > 0) return;
    setOtpError("");
    setOtp("");
    setLoading(true);
    try {
      await sendOtp(form.email);
      startCountdown();
    } catch {
      setApiError("Could not resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Whether submit button should be disabled (only block if known-invalid)
  const hasBlockingErrors = Object.values(fieldErrors).some(Boolean);
  const requiredFilled = form.first_name && form.last_name && form.email;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-slate-50">

      {/* ══ LEFT BRAND PANEL ═══════════════════════════════════ */}
      <div className="relative hidden overflow-hidden bg-indigo-950 lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:px-10 lg:py-12 xl:w-[42%] xl:px-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
          <div className="absolute -bottom-20 right-10 h-60 w-60 rounded-full bg-indigo-500/25 blur-3xl" />
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots-s" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="white" fillOpacity="0.07" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots-s)" />
          </svg>
        </div>
        <div className="relative space-y-10 mt-10 ms-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-indigo-300">Join your team</p>
            <h2 className="text-3xl font-extrabold leading-[1.15] text-white xl:text-4xl">Track every deal<br />from call to close.</h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-indigo-200">
              BBM gives your sales team one shared view of the entire pipeline — sign up to get started.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.icon} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.25 + i * 0.09 }}
                className="flex items-start gap-3 rounded-xl bg-white/[0.10] px-4 py-3 ring-1 ring-white/[0.12] backdrop-blur-sm">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-400/35">
                  <FeatureIcon icon={f.icon} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">{f.title}</p>
                  <p className="text-[11px] text-indigo-300">{f.desc}</p>
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
            {step === "form" && (
              <motion.div key="h-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mb-7 text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Create your account</h1>
                <p className="mt-1.5 text-sm text-slate-500">Your admin will approve access once you sign up.</p>
              </motion.div>
            )}
            {step === "otp" && (
              <motion.div key="h-otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mb-7 text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                  <svg className="h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Verify your email</h1>
                <p className="mt-1.5 text-sm text-slate-500">Enter the 6-digit code sent to <span className="font-semibold text-slate-700">{form.email}</span></p>
              </motion.div>
            )}
            {step === "pending" && (
              <motion.div key="h-pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mb-7 text-center">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
                  <svg className="h-6 w-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Awaiting approval</h1>
                <p className="mt-1.5 text-sm text-slate-500">Your account is set up — an admin will grant you access shortly.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-[0_2px_16px_0_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03] sm:px-7">
            <AnimatePresence mode="wait">

              {/* ── Profile form ───────────────────────────── */}
              {step === "form" && (
                <motion.div key="form-step" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }} className="space-y-4">

                  {/* First + Last name */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">First name</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><PersonIcon /></span>
                        <input
                          type="text" placeholder="Rohan" autoComplete="given-name" autoFocus
                          value={form.first_name}
                          onChange={set("first_name")}
                          onBlur={blur("first_name")}
                          className={inputCls(fieldErrors.first_name)}
                        />
                      </div>
                      <FieldError msg={fieldErrors.first_name} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Last name</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><PersonIcon /></span>
                        <input
                          type="text" placeholder="Mehta" autoComplete="family-name"
                          value={form.last_name}
                          onChange={set("last_name")}
                          onBlur={blur("last_name")}
                          className={inputCls(fieldErrors.last_name)}
                        />
                      </div>
                      <FieldError msg={fieldErrors.last_name} />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Work email</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><EmailIcon /></span>
                      <input
                        type="email" placeholder="you@company.com" autoComplete="email"
                        value={form.email}
                        onChange={set("email")}
                        onBlur={blur("email")}
                        className={inputCls(fieldErrors.email)}
                      />
                    </div>
                    <FieldError msg={fieldErrors.email} />
                  </div>

                  {/* Phone (optional) */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Phone <span className="normal-case font-normal text-slate-300">(optional)</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><PhoneIcon /></span>
                      <input
                        type="tel" placeholder="+91 98765 43210" autoComplete="tel"
                        value={form.phone}
                        onChange={set("phone")}
                        onBlur={blur("phone")}
                        className={inputCls(fieldErrors.phone)}
                      />
                    </div>
                    <FieldError msg={fieldErrors.phone} />
                  </div>

                  {apiError && <ErrorBanner msg={apiError} />}

                  <button
                    onClick={handleSignup}
                    disabled={loading || !requiredFilled || hasBlockingErrors}
                    className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
                        Creating account…
                      </span>
                    ) : "Create account & get code →"}
                  </button>
                </motion.div>
              )}

              {/* ── OTP step ───────────────────────────────── */}
              {step === "otp" && (
                <motion.div key="otp-step" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
                  <div className="mb-1">
                    <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-slate-400">6-digit code</label>
                    <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(""); }} disabled={loading} hasError={!!otpError} />
                  </div>
                  {otpError && (
                    <motion.p initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs font-medium text-rose-500 flex items-center gap-1">
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
                    ) : "Verify email →"}
                  </button>
                  <div className="mt-4 flex items-center justify-between text-[13px]">
                    <button onClick={() => { setStep("form"); setOtp(""); setApiError(""); setOtpError(""); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                      ← Edit details
                    </button>
                    <button onClick={handleResend} disabled={seconds > 0 || loading} className="font-semibold text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline transition-colors">
                      {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Pending step ───────────────────────────── */}
              {step === "pending" && (
                <motion.div key="pending-step" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="text-center py-2">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-2 ring-emerald-100">
                    <svg className="h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-1">
                    Email verified for <strong className="text-slate-800">{form.first_name} {form.last_name}</strong>.
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    Your admin has been notified. Once they assign your role, you can sign in.
                  </p>
                  <Link to="/" className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700">
                    Go to sign in
                  </Link>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {step !== "pending" && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link to="/" className="font-bold text-indigo-600 hover:underline">Sign in</Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}