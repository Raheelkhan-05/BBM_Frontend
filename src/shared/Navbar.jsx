import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

// Role-gated nav links — only show what the current user can access
const ALL_LINKS = [
  { to: "/dashboard", label: "Dashboard", roles: null }, // all authenticated
  { to: "/prospects",     label: "Prospects",     roles: ["Admin", "Salesperson"] },
  { to: "/leads",     label: "Leads",     roles: ["Admin", "Salesperson"] },
  { to: "/enquiries", label: "Enquiries",      roles: ["Admin", "Salesperson"] },
  { to: "/samples",   label: "Samples",   roles: ["Admin", "SalesCoordinator"] },
  { to: "/quotations",label: "Quotations",roles: ["Admin", "SalesCoordinator"] },
  { to: "/routes",    label: "Routes",    roles: ["Admin", "Salesperson"] },
  { to: "/products",  label: "Products",  roles: null }, // all authenticated
  { to: "/users",     label: "Users",     roles: ["Admin"] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const visibleLinks = user
    ? ALL_LINKS.filter((l) => !l.roles || l.roles.includes(user.role))
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5">
          <img src="/Logo.png" alt="BBM Logo" className="h-8 w-auto" />
          <span
            className="text-[18px] font-extrabold tracking-tight text-slate-900"
            style={{ fontFamily: "Nunito" }}
          >
            BBM
          </span>
        </Link>

        {/* Desktop links — only when logged in */}
        {user && (
          <div className="hidden items-center gap-1 lg:flex">
            {visibleLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `relative rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${
                    isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-indigo-600"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}

        {/* Right side auth controls */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* User role badge */}
              <span className="hidden rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/15 sm:inline-flex">
                {user.role}
              </span>
              <button
                onClick={logout}
                className="hidden rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:inline-block"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/"
                className="hidden rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:inline-block"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="hidden rounded-md bg-indigo-600 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700 sm:inline-block"
              >
                Sign up
              </Link>
            </>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-full z-50 border-t border-slate-200 bg-white shadow-xl lg:hidden"
          >
            <div className="flex flex-col gap-0.5 px-3 py-2">
              {user ? (
                <>
                  {/* Role badge */}
                  <div className="mb-1 px-3 py-1">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
                      {user.email} · {user.role}
                    </span>
                  </div>
                  {visibleLinks.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2.5 text-sm font-medium ${
                          isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                        }`
                      }
                    >
                      {l.label}
                    </NavLink>
                  ))}
                  <button
                    onClick={() => { logout(); setOpen(false); }}
                    className="mt-1 rounded-md px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}