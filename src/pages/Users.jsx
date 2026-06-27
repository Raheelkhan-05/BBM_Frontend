// Users.jsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Plus, X, Trash2, Users as UsersIcon, ShieldCheck,
  UserCheck, UserCog, UserX, Search, Pencil, Check, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth`;
const USERS_CACHE_KEY = "users_cache";
const USERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const ROLES        = ["UNASSIGNED", "Salesperson", "SalesCoordinator", "Admin"];
const CREATE_ROLES = ["Salesperson", "SalesCoordinator", "Admin"];

const ROLE_TONE = {
  Admin:            "bg-rose-50 text-rose-700 ring-rose-600/15",
  SalesCoordinator: "bg-violet-50 text-violet-700 ring-violet-600/15",
  Salesperson:      "bg-sky-50 text-sky-700 ring-sky-600/15",
  UNASSIGNED:       "bg-slate-100 text-slate-500 ring-slate-300/30",
};

const ROLE_ICON = {
  Admin:            ShieldCheck,
  SalesCoordinator: UserCog,
  Salesperson:      UserCheck,
  UNASSIGNED:       UserX,
};

/* ─── Icons ──────────────────────────────────────────────────── */
const Ic = {
  Cal:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  User:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Phone:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Pin:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Check:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20,6 9,17 4,12"/></svg>,
  X:      p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  Trophy: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 5H4a2 2 0 002 4M17 5h3a2 2 0 01-2 4"/></svg>,
  Flag:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 22V4a1 1 0 011-1c2 0 3 1 6 1s4-1 6-1a1 1 0 011 1v10c0 1-1 1-3 1s-4-1-6-1-4 1-6 1"/></svg>,
  ArrR:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Box:    p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  Receipt:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>,
  Empty:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>,
  Search: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Layers: p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="12,2 2,7 12,12 22,7 12,2"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>,
  Home:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  Bell:   p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  ChevD:  p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6,9 12,15 18,9"/></svg>,
  Refresh:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
};

function cls(...a){ return a.filter(Boolean).join(" "); }

/* ── Atoms ─────────────────────────────────────────────────────────── */

function Label({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
      {children}
    </label>
  );
}

function inputCls(extra = "") {
  return `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${extra}`;
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 transition-all duration-150 hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function DangerBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-200 transition-all duration-150 hover:bg-rose-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, tone = "slate", ...props }) {
  const tones = {
    slate:  "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
    rose:   "text-slate-400 hover:bg-rose-50 hover:text-rose-600",
    violet: "text-slate-400 hover:bg-violet-50 hover:text-violet-600",
  };
  return (
    <button
      {...props}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors duration-150 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Backdrop({ onClick, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

function ModalShell({ children, narrow = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className={`w-full ${narrow ? "max-w-sm" : "max-w-md"} rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 sm:p-6`}
    >
      {children}
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-20 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <UsersIcon size={22} className="text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-700">No users yet</p>
      <p className="mt-1 text-xs text-slate-400">Create the first user to get started</p>
    </div>
  );
}

function Avatar({ email, fullName }) {
  const initials = fullName
    ? fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : email
    ? email.slice(0, 2).toUpperCase()
    : "??";
  const palettes = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-indigo-100 text-indigo-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
  ];
  const color = palettes[email?.charCodeAt(0) % palettes.length] || palettes[0];
  return (
    <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-xs font-bold ${color}`}>
      {initials}
    </div>
  );
}

function StatPill({ count, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/15">
      <span className="text-sm font-bold">{count}</span>
      {label}
    </span>
  );
}

function RoleBadge({ role }) {
  const Icon = ROLE_ICON[role] || UserX;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ROLE_TONE[role] || ROLE_TONE.UNASSIGNED}`}>
      <Icon size={10} />
      {role}
    </span>
  );
}


/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
function BottomNav(){
  const items=[
    {id:"pipeline",  label:"Pipeline",   I:Ic.Layers, to:"/prospects"},
    {id:"products",  label:"Products",   I:Ic.Box,    to:"/products"},
    {id:"dashboard", label:"Dashboard",  I:Ic.Home,   to:"/dashboard"},
  ];
  const pathname=typeof window!=="undefined"?window.location.pathname:"";
  return(
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md safe-area-inset-bottom">
      {items.map(item=>{
        const I=item.I;
        const active=pathname===item.to||(item.to!=="/"&&pathname.startsWith(item.to));
        return(
          <Link key={item.id} to={item.to}
            className={cls("relative flex flex-1 flex-col items-center justify-center py-3 gap-0.5 transition-colors duration-200",
              active?"text-indigo-600":"text-slate-400 hover:text-slate-600")}>
            {active && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-indigo-600"/>
            )}
            <I className={cls("h-5 w-5 transition-transform duration-200",active?"text-indigo-600 scale-110":"")}/>
            <span className={cls("text-[10px] font-medium transition-colors duration-200",active?"text-indigo-600":"text-slate-400")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}



/* ── Main component ─────────────────────────────────────────────────── */

const emptyNew = { email: "", password: "", role: "Salesperson" };

export default function Users() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Create modal
  const [showCreate, setShowCreate]   = useState(false);
  const [newUser, setNewUser]         = useState(emptyNew);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit role modal
  const [editTarget, setEditTarget]       = useState(null);
  const [editRole, setEditRole]           = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

  // Confirm role change modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const { token } = useAuth();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };


  const fetchUsers = async ({ skipCache = false } = {}) => {
    if (!skipCache) {
      try {
        const raw = sessionStorage.getItem(USERS_CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < USERS_CACHE_TTL) {
            setUsers(data);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}
    }
  
    try {
      const res = await axios.get(`${API}/users`, authHeader);
      const list = res.data.users || [];
      setUsers(list);
      try {
        sessionStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list }));
      } catch (_) {}
    } catch {
      alert("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (!q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)) &&
      (!roleFilter || u.role === roleFilter)
    );
  }), [users, search, roleFilter]);

  /* create */
  const createUser = async (e) => {
    e.preventDefault();
    if (!newUser.email.trim() || !newUser.password.trim()) {
      setCreateError("Email and password are required");
      return;
    }
    setCreating(true); setCreateError("");
    try {
      await axios.post(`${API}/signup`, newUser, authHeader);
      setNewUser(emptyNew);
      setShowCreate(false);
      setUsers((prev) => [...prev, { ...newUser, id: Date.now(), role: newUser.role }]);
        try { sessionStorage.removeItem(USERS_CACHE_KEY); } catch (_) {}
        setNewUser(emptyNew);
        setShowCreate(false);
        // Then do a background refresh to get the real server-assigned id/data:
        fetchUsers({ skipCache: true });

    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  /* open edit role modal */
  function openEdit(u) {
    setEditTarget(u);
    setEditRole(u.role);
    setShowEditModal(true);
  }

  /* proceed to confirm */
  function proceedConfirm(e) {
    e.preventDefault();
    if (editRole === editTarget.role) {
      setShowEditModal(false);
      return;
    }
    setShowEditModal(false);
    setShowConfirm(true);
  }

  /* confirmed — save */
  const confirmRoleChange = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/users/${editTarget.id}`, { role: editRole }, authHeader);
      setUsers((prev) =>
        prev.map((u) => u.id === editTarget.id ? { ...u, role: editRole } : u)
      );
      try { sessionStorage.removeItem(USERS_CACHE_KEY); } catch (_) {}
    } catch {
      alert("Update failed");
    } finally {
      setSaving(false);
      setShowConfirm(false);
      setEditTarget(null);
    }
  };

  /* delete */
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/users/${deleteTarget.id}`, authHeader);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      try { sessionStorage.removeItem(USERS_CACHE_KEY); } catch (_) {}
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const hasActiveFilters = search || roleFilter;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-violet-500">
              Organisation
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">User Management</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatPill count={filtered.length} label={filtered.length !== 1 ? "users" : "user"} />
            <PrimaryBtn onClick={() => { setCreateError(""); setNewUser(emptyNew); setShowCreate(true); }}>
              <Plus size={15} /> Add User
            </PrimaryBtn>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_180px_auto]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search by email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls("pl-9")}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={inputCls("appearance-none cursor-pointer")}
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setRoleFilter(""); }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-100 bg-white" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && <EmptyState />}

        {/* ── User list ───────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mb-14 md:mb-0"
          >
            <AnimatePresence>
              {filtered.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.03 }}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 ${i > 0 ? "border-t border-slate-100" : ""}`}
                >
                  <Avatar email={u.email} fullName={u.full_name} />

                  <div className="min-w-0 flex-1">
                    {u.full_name && (
                      <p className="truncate text-sm font-semibold text-slate-800">{u.full_name}</p>
                    )}
                    <p className={`truncate text-sm text-slate-500 ${!u.full_name ? "font-semibold text-slate-800" : ""}`}>
                      {u.email}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <RoleBadge role={u.role} />
                      {u.phone && (
                        <span className="text-[11px] text-slate-400 font-medium">{u.phone}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <IconBtn tone="violet" onClick={() => openEdit(u)} title="Edit role">
                      <Pencil size={14} />
                    </IconBtn>
                    <IconBtn tone="rose" onClick={() => setDeleteTarget(u)} title="Delete user">
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Create user modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <Backdrop onClick={() => setShowCreate(false)}>
            <ModalShell>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Add User</h3>
                  <p className="mt-0.5 text-xs text-slate-400">New account will be active immediately</p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={createUser}>
                <div className="mb-4">
                  <Label>Email address *</Label>
                  <input type="email" placeholder="user@company.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className={inputCls()} />
                </div>
                <div className="mb-4">
                  <Label>Password *</Label>
                  <input type="password" placeholder="Set a password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className={inputCls()} />
                </div>
                <div className="mb-4">
                  <Label>Role</Label>
                  <select value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className={inputCls("appearance-none cursor-pointer")}>
                    {CREATE_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                {createError && <p className="mb-3 text-sm text-rose-600">{createError}</p>}
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowCreate(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={creating}>
                    {creating ? "Creating…" : "Create User"}
                  </PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ── Edit role modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showEditModal && editTarget && (
          <Backdrop onClick={() => setShowEditModal(false)}>
            <ModalShell>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Edit Role</h3>
                  <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[280px]">{editTarget.email}</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Current role */}
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <Avatar email={editTarget.email} />
                <div>
                  <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Current role</p>
                  <RoleBadge role={editTarget.role} />
                </div>
              </div>

              <form onSubmit={proceedConfirm}>
                <div className="mb-4">
                  <Label>New Role</Label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className={inputCls("appearance-none cursor-pointer")}
                  >
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>

                {/* Change preview */}
                {editRole && editRole !== editTarget.role && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-2.5">
                    <Check size={13} className="text-violet-500 shrink-0" />
                    <span className="text-xs text-violet-600 font-medium">Will change to</span>
                    <RoleBadge role={editRole} />
                  </div>
                )}

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <GhostBtn type="button" onClick={() => setShowEditModal(false)}>Cancel</GhostBtn>
                  <PrimaryBtn type="submit">
                    {editRole === editTarget.role ? "No Changes" : "Save Role"}
                  </PrimaryBtn>
                </div>
              </form>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ── Role change confirmation ─────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && editTarget && (
          <Backdrop onClick={() => !saving && setShowConfirm(false)}>
            <ModalShell narrow>
              <div className="mb-4 flex items-start gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-violet-50 ring-1 ring-violet-100">
                  <UserCog size={18} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirm Role Change</h3>
                  <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[220px]">{editTarget.email}</p>
                </div>
              </div>

              <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <RoleBadge role={editTarget.role} />
                <span className="text-slate-300 text-sm font-medium">→</span>
                <RoleBadge role={editRole} />
              </div>

              <p className="mb-5 text-sm text-slate-500">
                This will update the user's permissions immediately. Are you sure you want to proceed?
              </p>

              <div className="flex justify-end gap-2.5">
                <GhostBtn onClick={() => setShowConfirm(false)} disabled={saving}>Cancel</GhostBtn>
                <PrimaryBtn onClick={confirmRoleChange} disabled={saving}>
                  <Check size={14} />
                  {saving ? "Saving…" : "Confirm Change"}
                </PrimaryBtn>
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ──────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <Backdrop onClick={() => !deleting && setDeleteTarget(null)}>
            <ModalShell narrow>
              <div className="mb-4 flex items-start gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-rose-50 ring-1 ring-rose-100">
                  <AlertTriangle size={18} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete User</h3>
                  <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[220px]">{deleteTarget.email}</p>
                </div>
              </div>

              <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <Avatar email={deleteTarget.email} fullName={deleteTarget.full_name} />
                <div>
                  {deleteTarget.full_name && (
                    <p className="text-sm font-semibold text-slate-800">{deleteTarget.full_name}</p>
                    )}
                    <p className={`text-sm ${deleteTarget.full_name ? "text-slate-500" : "font-semibold text-slate-800"}`}>
                    {deleteTarget.email}
                    </p>
                  <div className="mt-1"><RoleBadge role={deleteTarget.role} /></div>
                </div>
              </div>

              <p className="mb-5 text-sm text-slate-500">
                This action is permanent and cannot be undone. The user will immediately lose all access.
              </p>

              <div className="flex justify-end gap-2.5">
                <GhostBtn onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</GhostBtn>
                <DangerBtn onClick={confirmDelete} disabled={deleting}>
                  <Trash2 size={14} />
                  {deleting ? "Deleting…" : "Delete User"}
                </DangerBtn>
              </div>
            </ModalShell>
          </Backdrop>
        )}
      </AnimatePresence>

      <BottomNav/>
    </div>
  );
}