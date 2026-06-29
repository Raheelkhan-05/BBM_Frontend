import { useState, useRef, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const ChevronDown = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7.5l5 5 5-5" />
  </svg>
);
const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10l5 5 7-8" />
  </svg>
);
const SearchIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M15.5 15.5l-3-3" />
  </svg>
);
const XIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
);
const LockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

function cls(...args) { return args.filter(Boolean).join(" "); }

/* ─── OptionRow ─────────────────────────────────────────────── */
const OptionRow = memo(function OptionRow({ opt, active, mobile, onPick }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onPick(opt.value); }}
      className={cls(
        "flex w-full items-center text-left transition-colors duration-75",
        mobile
          ? cls("gap-4 px-5 py-3.5 border-b border-slate-50 last:border-0",
              active ? "bg-indigo-50" : "bg-white active:bg-slate-100")
          : cls("gap-2 px-3 py-1.5",
              active ? "bg-indigo-50" : "hover:bg-slate-50")
      )}
    >
      <span className="flex-1 min-w-0">
        <span className={cls(
          "block truncate leading-snug",
          mobile ? "text-[14px]" : "text-[11px]",
          active ? "font-medium text-indigo-700" : "font-normal text-slate-700"
        )}>
          {opt.label}
        </span>
        {opt.description && (
          <span className={cls(
            "block text-slate-400 mt-0.5 truncate",
            mobile ? "text-[12px]" : "text-[10px]"
          )}>
            {opt.description}
          </span>
        )}
      </span>
      {mobile ? (
        active
          ? <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
              <CheckIcon className="h-3 w-3 text-white" />
            </span>
          : <span className="shrink-0 h-5 w-5 rounded-full border-2 border-slate-200" />
      ) : (
        active && (
          <span className="shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600">
            <CheckIcon className="h-2 w-2 text-white" />
          </span>
        )
      )}
    </button>
  );
});

/* ─── Desktop dropdown ──────────────────────────────────────── */
function DesktopDropdown({ allGroups, filteredMap, value, showSearch, searchRef, search, onSearch, isEmpty, onPick, anchor, openUp }) {
  const ITEM_H   = 28;
  const HEADER_H = 24;
  const SEARCH_H = 37;
  const EMPTY_H  = 64;
  const PAD_V    = 4;
  const MAX_LIST = 180;

  let contentH = PAD_V;
  if (isEmpty) {
    contentH += EMPTY_H;
  } else {
    allGroups.forEach((g, gi) => {
      const opts = filteredMap[gi] || [];
      if (g.label && opts.length > 0) contentH += HEADER_H;
      contentH += opts.length * ITEM_H;
    });
  }
  const listH = Math.min(contentH, MAX_LIST);

  return (
    <motion.div
      key="cs-desktop"
      data-cs-portal="true"
      initial={{ opacity: 0, y: openUp ? 5 : -5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: openUp ? 5 : -5, scale: 0.97 }}
      transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "fixed",
        zIndex:   9999,
        left:     anchor.left,
        width:    Math.max(anchor.width, 160),
        ...(openUp ? { bottom: anchor.bottom } : { top: anchor.top }),
      }}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
    >
      {showSearch && (
        <div className="shrink-0 border-b border-slate-100 px-2 py-1.5 bg-white">
          <div className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-1.5 h-2.5 w-2.5 text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md bg-slate-50 pr-2 text-[11px] text-slate-800 outline-none placeholder:text-slate-400 border border-transparent focus:border-indigo-200 focus:bg-white transition-colors"
              style={{ paddingLeft: 20, paddingTop: 4, paddingBottom: 4, height: 22 }}
            />
          </div>
        </div>
      )}
      <motion.div
        animate={{ height: listH }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-y-auto overscroll-contain"
        style={{ height: listH }}
      >
        <div className="py-0.5">
          {allGroups.map((group, gi) => {
            const opts = filteredMap[gi] || [];
            return (
              <div key={gi}>
                {group.label && opts.length > 0 && (
                  <p className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    {group.label}
                  </p>
                )}
                <AnimatePresence initial={false} mode="sync">
                  {opts.map((opt) => (
                    <motion.div
                      key={opt.value}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1, ease: "linear" }}
                    >
                      <OptionRow opt={opt} active={opt.value === value} mobile={false} onPick={onPick} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
          <AnimatePresence>
            {isEmpty && (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="px-3 py-5 text-center text-[10px] text-slate-400 italic"
              >
                {search.trim() ? `No results for "${search}"` : "No options"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Mobile sheet ──────────────────────────────────────────── */
function MobileSheet({ allGroups, filteredMap, value, showSearch, searchRef, search, onSearch, isEmpty, onPick, label, placeholder, onClose }) {
  // Mobile sheet height is FIXED — computed once from viewport, never changes.
  // 56vh is enough for a comfortable list. Content fades inside; sheet stays put.
  const SHEET_H = Math.round(window.innerHeight * 0.75);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="cs-mob-bg"
        data-cs-portal="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        style={{ zIndex: 9998 }}
        onMouseDown={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Sheet — fixed height, never changes */}
      <motion.div
        key="cs-mob-sheet"
        data-cs-portal="true"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-0 left-0 right-0 rounded-t-3xl bg-white shadow-2xl"
        // height is hard-fixed — sheet never resizes as results change
        style={{ zIndex: 9999, height: SHEET_H, display: "flex", flexDirection: "column" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <p className="text-[15px] font-bold text-slate-900 tracking-tight">{label || placeholder}</p>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClose(); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search — shrink-0 so it never moves */}
        {showSearch && (
          <div className="px-4 pb-3 shrink-0">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full rounded-xl bg-slate-100 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 border border-transparent focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-colors"
                style={{ paddingLeft: 36, paddingRight: 12 }}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="shrink-0 border-t border-slate-100" />

        {/*
          List area — flex-1 + overflow-y-auto.
          The sheet itself is fixed height so this area never changes size.
          Items inside fade in/out. No height jump anywhere.
        */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {allGroups.map((group, gi) => {
            const opts = filteredMap[gi] || [];
            return (
              <div key={gi}>
                {group.label && opts.length > 0 && (
                  <p className="px-5 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {group.label}
                  </p>
                )}
                {/*
                  AnimatePresence fades items in/out as search filters.
                  No layout animation — pure opacity. Fast (100ms) so it
                  feels responsive without lagging behind keystrokes.
                */}
                <AnimatePresence initial={false} mode="sync">
                  {opts.map((opt) => (
                    <motion.div
                      key={opt.value}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1, ease: "linear" }}
                    >
                      <OptionRow opt={opt} active={opt.value === value} mobile={true} onPick={onPick} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Empty state fades in/out */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div
                key="mob-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center justify-center px-5 py-12"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <SearchIcon className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-[13px] font-medium text-slate-500">
                  {search.trim() ? `No results for "${search}"` : "No options"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom safe-area padding */}
          <div className="h-6" />
        </div>
      </motion.div>
    </>
  );
}

/* ─── CustomSelect ──────────────────────────────────────────── */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  grouped,
  placeholder = "Select…",
  label,
  required,
  disabled,
  error,
  icon: Icon_,
  searchable,
  compact = false,
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, bottom: 0, left: 0, width: 0 });

  const mobileRef  = useRef(false);
  const triggerRef = useRef(null);
  const searchRef  = useRef(null);

  const norm = (arr) =>
    (arr || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  const allGroups = grouped
    ? grouped.map((g) => ({ ...g, options: norm(g.options) }))
    : [{ label: null, options: norm(options) }];

  const flatOptions = allGroups.flatMap((g) => g.options);
  const selected    = flatOptions.find((o) => o.value === value) ?? null;
  const showSearch  = searchable !== undefined ? searchable : flatOptions.length > 6;

  const q = search.trim().toLowerCase();
  const filteredMap = allGroups.map((g) =>
    q
      ? g.options.filter((o) =>
          o.label.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q))
      : g.options
  );
  const isEmpty = filteredMap.every((arr) => arr.length === 0);

  const calcAnchor = useCallback(() => {
    if (!triggerRef.current) return;
    const r     = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    setOpenUp(below < 260 && above > below);
    setAnchor({
      top:    r.bottom + 3,
      bottom: window.innerHeight - r.top + 3,
      left:   r.left,
      width:  r.width,
    });
  }, []);

  function openSelect() {
    if (disabled || open) return;
    mobileRef.current = window.innerWidth < 768;
    calcAnchor();
    setSearch("");
    setOpen(true);
  }

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const pick = useCallback((val) => {
    onChange(val);
    close();
  }, [onChange, close]);

  useEffect(() => {
    if (open && showSearch && !mobileRef.current) {
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (e.target.closest("[data-cs-portal]")) return;
      close();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, close]);

  useEffect(() => {
    if (!open || mobileRef.current) return;
    window.addEventListener("resize", calcAnchor);
    return () => window.removeEventListener("resize", calcAnchor);
  }, [open, calcAnchor]);

  const triggerPy = compact ? "py-1" : "py-1.5";

  return (
    <div className="flex flex-col w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openSelect}
        className={cls(
          "relative flex w-full items-center gap-1.5 rounded-lg border px-2.5 text-left transition-all duration-150 outline-none",
          triggerPy,
          disabled
            ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-70"
            : error
            ? "border-rose-400 bg-rose-50/30 ring-2 ring-rose-100"
            : open
            ? "border-indigo-400 bg-white ring-2 ring-indigo-100 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"
        )}
      >
        {Icon_ && (
          <Icon_ className={cls(
            "h-3 w-3 shrink-0",
            disabled ? "text-slate-300" : error ? "text-rose-400" : "text-slate-400"
          )} />
        )}
        <span className={cls(
          "flex-1 truncate text-[12px] leading-5 font-normal",
          selected ? "text-slate-700" : "text-slate-400"
        )}>
          {selected ? selected.label : placeholder}
        </span>
        {disabled ? (
          <LockIcon className="h-2.5 w-2.5 shrink-0 text-slate-300" />
        ) : (
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18 }}
            className="shrink-0 flex"
          >
            <ChevronDown className={cls(
              "h-3 w-3 transition-colors",
              open ? "text-indigo-400" : "text-slate-300"
            )} />
          </motion.span>
        )}
      </button>

      {error && <p className="mt-0.5 text-[10px] text-rose-500">{error}</p>}

      {createPortal(
        <AnimatePresence>
          {open && !mobileRef.current && (
            <DesktopDropdown
              allGroups={allGroups}
              filteredMap={filteredMap}
              value={value}
              showSearch={showSearch}
              searchRef={searchRef}
              search={search}
              onSearch={setSearch}
              isEmpty={isEmpty}
              onPick={pick}
              anchor={anchor}
              openUp={openUp}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {open && mobileRef.current && (
            <MobileSheet
              allGroups={allGroups}
              filteredMap={filteredMap}
              value={value}
              showSearch={showSearch}
              searchRef={searchRef}
              search={search}
              onSearch={setSearch}
              isEmpty={isEmpty}
              onPick={pick}
              label={label}
              placeholder={placeholder}
              onClose={close}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}