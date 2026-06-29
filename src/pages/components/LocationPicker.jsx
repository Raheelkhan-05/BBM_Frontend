// LocationPicker.jsx — full replacement
// Only change: native <select> elements → CustomSelect.
// All logic (locking, cascading clears, createRoute) is unchanged.

import { useState } from "react";
import CustomSelect from "./CustomSelect"; // adjust path as needed

export default function LocationPicker({
  country,
  state,
  city,
  zone,
  route,
  onChange,
  useRoutesHook,
  errors = {},
  disabled = false,
  lockedFields = new Set(),
}) {
  const {
    countries,
    states,
    cities,
    zones,
    routeNames,
    createRoute,
  } = useRoutesHook;

  const [creatingRoute, setCreatingRoute] = useState(false);
  const [newCountry, setNewCountry]       = useState("");
  const [newState,   setNewState]         = useState("");
  const [newCity,    setNewCity]          = useState("");
  const [newZone,    setNewZone]          = useState("");
  const [newRoute,   setNewRoute]         = useState("");
  const [creating,   setCreating]         = useState(false);
  const [createError, setCreateError]     = useState("");

  const locked   = new Set(lockedFields);
  const isLocked = (field) => disabled || locked.has(field);

  const filteredStates = country ? states(country) : [];
  const filteredCities = country && state ? cities(country, state) : [];
  const filteredZones  = country && state && city ? zones(country, state, city) : [];
  const filteredRoutes = country && state && city && zone ? routeNames(country, state, city, zone) : [];

  function handleCountry(val) {
    if (isLocked("country")) return;
    onChange("country", val);
    onChange("state",   "");
    onChange("city",    "");
    onChange("zone",    "");
    onChange("route",   "");
  }
  function handleState(val) {
    if (isLocked("state")) return;
    onChange("state", val);
    onChange("city",  "");
    onChange("zone",  "");
    onChange("route", "");
  }
  function handleCity(val) {
    if (isLocked("city")) return;
    onChange("city", val);
    onChange("zone", "");
    onChange("route", "");
  }
  function handleZone(val) {
    if (isLocked("zone")) return;
    onChange("zone",  val);
    onChange("route", "");
  }
  function handleRoute(val) {
    if (isLocked("route")) return;
    onChange("route", val);
  }

  async function handleCreateRoute() {
    if (!newCountry.trim() || !newState.trim() || !newCity.trim() || !newZone.trim() || !newRoute.trim()) {
      setCreateError("All fields are required");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await createRoute(newCountry.trim(), newState.trim(), newCity.trim(), newZone.trim(), newRoute.trim());
      onChange("country", newCountry.trim());
      onChange("state",   newState.trim());
      onChange("city",    newCity.trim());
      onChange("zone",    newZone.trim());
      onChange("route",   newRoute.trim());
      setCreatingRoute(false);
      setNewCountry(""); setNewState(""); setNewCity(""); setNewZone(""); setNewRoute("");
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  const anyLocked  = locked.size > 0 || disabled;
  const allDisabled = disabled;

  const FieldError = ({ name }) =>
    errors[name] ? <p className="mt-1 text-[11px] text-rose-500">{errors[name]}</p> : null;

  const fieldLabel = (text, fieldName, req) => (
    <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {text}
      {req && <span className="text-rose-500">*</span>}
      {isLocked(fieldName) && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" style={{ display: "inline", marginLeft: 2 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      )}
    </label>
  );

  return (
    <div style={{ gridColumn: "1 / -1" }}>

      {/* Lock notice */}
      {anyLocked && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          {allDisabled
            ? "Location prefilled from prospect — edit the prospect record to change."
            : "Some fields are prefilled and locked. Blank fields can still be set here."}
        </div>
      )}

      <div className="flex flex-col gap-3">

        {/* Row 1 — Country + State */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            {fieldLabel("Country", "country", true)}
            <CustomSelect
              value={country}
              onChange={handleCountry}
              options={countries}
              placeholder="Select Country"
              label="Country"
              disabled={isLocked("country")}
              error={errors.country}
            />
            <FieldError name="country" />
          </div>
          <div>
            {fieldLabel("State", "state", true)}
            <CustomSelect
              value={state}
              onChange={handleState}
              options={filteredStates}
              placeholder={country ? "Select State" : "Select Country first"}
              label="State"
              disabled={isLocked("state") || !country}
              error={errors.state}
            />
            <FieldError name="state" />
          </div>
        </div>

        {/* Row 2 — City + Zone + Route */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            {fieldLabel("City", "city", true)}
            <CustomSelect
              value={city}
              onChange={handleCity}
              options={filteredCities}
              placeholder={state ? "Select City" : "Select State first"}
              label="City"
              disabled={isLocked("city") || !state}
              error={errors.city}
            />
            <FieldError name="city" />
          </div>
          <div>
            {fieldLabel("Zone", "zone", false)}
            <CustomSelect
              value={zone}
              onChange={handleZone}
              options={filteredZones}
              placeholder={city ? "Select Zone" : "Select City first"}
              label="Zone"
              disabled={isLocked("zone") || !city}
              error={errors.zone}
            />
            <FieldError name="zone" />
          </div>
          <div>
            {fieldLabel("Route", "route", false)}
            <CustomSelect
              value={route}
              onChange={handleRoute}
              options={filteredRoutes}
              placeholder={zone ? "Select Route" : "Select Zone first"}
              label="Route"
              disabled={isLocked("route") || !zone}
              error={errors.route}
            />
            <FieldError name="route" />
          </div>
        </div>

      </div>

      {/* Add new location */}
      {!allDisabled && (
        !creatingRoute ? (
          <button
            type="button"
            onClick={() => setCreatingRoute(true)}
            className="mt-2.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            + Location not listed? Add new
          </button>
        ) : (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Add New Location
            </p>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Country" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                <input placeholder="State"   value={newState}   onChange={(e) => setNewState(e.target.value)}   className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="City"  value={newCity}  onChange={(e) => setNewCity(e.target.value)}  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                <input placeholder="Zone"  value={newZone}  onChange={(e) => setNewZone(e.target.value)}  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                <input placeholder="Route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
            </div>
            {createError && <p className="mt-1.5 text-[11px] text-rose-500">{createError}</p>}
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={handleCreateRoute}
                disabled={creating}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {creating ? "Saving…" : "Save Location"}
              </button>
              <button
                type="button"
                onClick={() => { setCreatingRoute(false); setCreateError(""); }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}