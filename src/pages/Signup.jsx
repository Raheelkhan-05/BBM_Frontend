import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { signupUser } from "../api/auth";

const FEATURES = [
  { icon: "pipeline", title: "Full pipeline tracking",   desc: "Prospect → Lead → Enquiry → Order"       },
  { icon: "followup", title: "Never miss a follow-up",   desc: "Smart dates with overdue alerts"          },
  { icon: "team",     title: "Built for teams",          desc: "Role-based access for every member"       },
  { icon: "reports",  title: "Instant visibility",       desc: "Your whole pipeline at a glance"          },
];

function FeatureIcon({ icon }) {
  // ✦ Icons lifted to indigo-200 (was indigo-300) for better contrast
  const cls = "h-4 w-4 text-indigo-200";
  if (icon === "pipeline")
    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
  if (icon === "followup")
    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (icon === "team")
    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

export default function Signup() {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const data = await signupUser(form);
      setSuccess(data.message || "Account created! You can now sign in.");
      setForm({ email: "", password: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-slate-50">

      {/* ══ LEFT BRAND PANEL (lg+) ══════════════════════════════ */}
      <div className="relative hidden overflow-hidden bg-indigo-950 lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:px-10 lg:py-12 xl:w-[42%] xl:px-14">

        {/* Background texture */}
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

        {/* Hero + feature list */}
        <div className="relative space-y-10 mt-10 ms-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* ✦ Eyebrow — lifted from indigo-400 → indigo-300 */}
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-indigo-300">
              Join your team
            </p>
            {/* ✦ Headline — pure white, unchanged */}
            <h2 className="text-3xl font-extrabold leading-[1.15] text-white xl:text-4xl">
              Track every deal<br />from call to close.
            </h2>
            {/* ✦ Sub-copy — lifted from indigo-300/75 → indigo-200 */}
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-indigo-200">
              BBM gives your sales team one shared view of the entire pipeline — sign up to get started.
            </p>
          </motion.div>

          {/* Feature tiles */}
          <div className="grid grid-cols-1 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.icon}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.09 }}
                
                className="flex items-start gap-3 rounded-xl bg-white/[0.10] px-4 py-3 ring-1 ring-white/[0.12] backdrop-blur-sm"
              >
                {/* ✦ Icon container lifted from indigo-500/20 → indigo-400/35 */}
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-400/35">
                  <FeatureIcon icon={f.icon} />
                </div>
                <div>
                  {/* ✦ Tile title — now pure white (was white) — kept white, good */}
                  <p className="text-[13px] font-semibold text-white">{f.title}</p>
                  {/* ✦ Tile description lifted from indigo-400 → indigo-300 */}
                  <p className="text-[11px] text-indigo-300">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer — lifted from indigo-600 → indigo-500 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="relative text-[11px] text-indigo-500 ms-10"
        >
          © {new Date().getFullYear()} BBM · Built for teams who move fast
        </motion.p>
      </div>

      {/* ══ RIGHT FORM PANEL ════════════════════════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >

          {/* Mobile-only brand badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mb-8 flex justify-center lg:hidden"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-600 shadow-sm">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Brand Brigade Marketing
            </span>
          </motion.div>

          {/* Heading */}
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Your admin will approve access once you sign up.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-[0_2px_16px_0_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03] sm:px-7">
            <form onSubmit={handleSubmit} noValidate>

              {/* Email */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Work email
                </label>
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    autoComplete="email"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-100 hover:border-slate-300"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Choose a strong password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-100 hover:border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPwd
                      ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3"
                >
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-sm font-medium text-rose-600">{error}</p>
                </motion.div>
              )}

              {/* Success */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3"
                >
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  <p className="text-sm font-medium text-emerald-700">{success}</p>
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                    </svg>
                    Creating account…
                  </span>
                ) : "Create account →"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/" className="font-bold text-indigo-600 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}