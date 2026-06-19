// Users.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Plus, X, Trash2, Users as UsersIcon, ShieldCheck,
  UserCheck, UserCog, UserX, Search, Pencil, Check, AlertTriangle,
} from "lucide-react";

const API = "http://localhost:5000/api/auth";

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

function Avatar({ email }) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "??";
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

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data.users);
    } catch {
      alert("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (!q || u.email?.toLowerCase().includes(q)) &&
      (!roleFilter || u.role === roleFilter)
    );
  });

  /* create */
  const createUser = async (e) => {
    e.preventDefault();
    if (!newUser.email.trim() || !newUser.password.trim()) {
      setCreateError("Email and password are required");
      return;
    }
    setCreating(true); setCreateError("");
    try {
      await axios.post(`${API}/signup`, newUser);
      setNewUser(emptyNew);
      setShowCreate(false);
      fetchUsers();
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
      await axios.put(`${API}/users/${editTarget.id}`, { role: editRole });
      fetchUsers();
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
      await axios.delete(`${API}/users/${deleteTarget.id}`);
      fetchUsers();
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
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-violet-500">
              Organisation
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">
              User Management
            </h1>
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
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
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
                  <Avatar email={u.email} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.email}</p>
                    <div className="mt-1">
                      <RoleBadge role={u.role} />
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
                <Avatar email={deleteTarget.email} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{deleteTarget.email}</p>
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
    </div>
  );
}