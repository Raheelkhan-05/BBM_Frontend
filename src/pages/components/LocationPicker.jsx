import { useState } from "react";

// `lockedFields` is a Set (or array) of field names that should be
// rendered as read-only because they were prefilled from a prospect.
// Any field NOT in the set stays fully editable.
//
// Usage (call site):
//
//   const lockedFields = linkedProspect
//     ? new Set(
//         ["country", "state", "city", "zone", "route"].filter(
//           (f) => !!linkedProspect[f]
//         )
//       )
//     : new Set();
//
//   <LocationPicker
//     ...
//     lockedFields={lockedFields}
//   />

export default function LocationPicker({
  country,
  state,
  city,
  zone,
  route,
  onChange,
  useRoutesHook,
  errors = {},
  // Legacy boolean prop kept for backwards compat — locks ALL fields
  disabled = false,
  // New: Set or array of field names to lock individually
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

  const FieldError = ({ name }) =>
    errors[name] ? (
      <p style={{ color: "#f43f5e", fontSize: 11, marginTop: 3 }}>{errors[name]}</p>
    ) : null;

  const [creatingRoute, setCreatingRoute] = useState(false);
  const [newCountry, setNewCountry] = useState("");
  const [newState,   setNewState]   = useState("");
  const [newCity,    setNewCity]    = useState("");
  const [newZone,    setNewZone]    = useState("");
  const [newRoute,   setNewRoute]   = useState("");
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState("");

  // Normalise: support both Set and plain array
  const locked = new Set(lockedFields);

  // A field is disabled if the blanket `disabled` prop is set OR
  // the field name appears in `lockedFields`
  const isLocked = (field) => disabled || locked.has(field);

  const filteredStates = country ? states(country) : [];
  const filteredCities = country && state ? cities(country, state) : [];
  const filteredZones  = country && state && city ? zones(country, state, city) : [];
  const filteredRoutes = country && state && city && zone ? routeNames(country, state, city, zone) : [];

  function handleCountry(e) {
    if (isLocked("country")) return;
    onChange("country", e.target.value);
    onChange("state", "");
    onChange("city", "");
    onChange("zone", "");
    onChange("route", "");
  }

  function handleState(e) {
    if (isLocked("state")) return;
    onChange("state", e.target.value);
    onChange("city", "");
    onChange("zone", "");
    onChange("route", "");
  }

  function handleCity(e) {
    if (isLocked("city")) return;
    onChange("city", e.target.value);
    onChange("zone", "");
    onChange("route", "");
  }

  function handleZone(e) {
    if (isLocked("zone")) return;
    onChange("zone", e.target.value);
    onChange("route", "");
  }

  function handleRoute(e) {
    if (isLocked("route")) return;
    onChange("route", e.target.value);
  }

  async function handleCreateRoute() {
    if (
      !newCountry.trim() ||
      !newState.trim()   ||
      !newCity.trim()    ||
      !newZone.trim()    ||
      !newRoute.trim()
    ) {
      setCreateError("All fields are required");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      await createRoute(
        newCountry.trim(),
        newState.trim(),
        newCity.trim(),
        newZone.trim(),
        newRoute.trim()
      );

      onChange("country", newCountry.trim());
      onChange("state",   newState.trim());
      onChange("city",    newCity.trim());
      onChange("zone",    newZone.trim());
      onChange("route",   newRoute.trim());

      setCreatingRoute(false);
      setNewCountry(""); setNewState(""); setNewCity("");
      setNewZone("");    setNewRoute("");
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  // ── Per-field select style ────────────────────────────────────
  const selectStyle = (field) => ({
    width: "100%",
    padding: "7px 10px",
    border: `1px solid ${isLocked(field) ? "#e2e8f0" : "#cbd5e1"}`,
    borderRadius: 6,
    fontSize: 13,
    background: isLocked(field) ? "#f8fafc" : "#fff",
    color: isLocked(field) ? "#64748b" : "#0f172a",
    cursor: isLocked(field) ? "not-allowed" : "pointer",
    opacity: isLocked(field) ? 0.8 : 1,
  });

  const sel = (field, value, handler, options, placeholder) => (
    <select
      value={value}
      onChange={handler}
      disabled={isLocked(field)}
      style={selectStyle(field)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  // Whether ANY field is locked (to decide whether to show the notice)
  const anyLocked = locked.size > 0 || disabled;
  // Whether ALL editable fields are unlocked (hide "add route" button
  // only when the entire picker is blanket-disabled)
  const allDisabled = disabled;

  return (
    <div style={{ gridColumn: "1 / -1" }}>

      {/* Lock notice — shown when at least some fields are prefilled */}
      {anyLocked && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            padding: "6px 10px",
            background: "#fef9f0",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            fontSize: 12,
            color: "#92400e",
            fontWeight: 500,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          {allDisabled
            ? "Location prefilled from prospect — edit the prospect record to change these values."
            : "Some fields are prefilled from the linked prospect and are locked. Blank fields (e.g. Zone, Route) can still be set here."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Row 1 — Country + State */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>
              Country <span style={star}>*</span>
              {isLocked("country") && <LockIcon />}
            </label>
            {sel("country", country, handleCountry, countries, "Select Country")}
            <FieldError name="country" />
          </div>
          <div>
            <label style={lbl}>
              State <span style={star}>*</span>
              {isLocked("state") && <LockIcon />}
            </label>
            {sel("state", state, handleState, filteredStates, country ? "Select State" : "Select Country First")}
            <FieldError name="state" />
          </div>
        </div>

        {/* Row 2 — City + Zone + Route */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>
              City <span style={star}>*</span>
              {isLocked("city") && <LockIcon />}
            </label>
            {sel("city", city, handleCity, filteredCities, state ? "Select City" : "Select State First")}
            <FieldError name="city" />
          </div>
          <div>
            <label style={lbl}>
              Zone
              {isLocked("zone") && <LockIcon />}
            </label>
            {sel("zone", zone, handleZone, filteredZones, city ? "Select Zone" : "Select City First")}
            <FieldError name="zone" />
          </div>
          <div>
            <label style={lbl}>
              Route
              {isLocked("route") && <LockIcon />}
            </label>
            {sel("route", route, handleRoute, filteredRoutes, zone ? "Select Route" : "Select Zone First")}
            <FieldError name="route" />
          </div>
        </div>

      </div>

      {/* Add new location — hidden only when entirely blanket-disabled */}
      {!allDisabled && (
        !creatingRoute ? (
          <button
            type="button"
            onClick={() => setCreatingRoute(true)}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              marginTop: 6,
            }}
          >
            + Location not listed? Add new
          </button>
        ) : (
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            marginTop: 8,
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#475569" }}>
              ADD NEW LOCATION
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input placeholder="Country" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} style={inp} />
                <input placeholder="State"   value={newState}   onChange={(e) => setNewState(e.target.value)}   style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <input placeholder="City"  value={newCity}  onChange={(e) => setNewCity(e.target.value)}  style={inp} />
                <input placeholder="Zone"  value={newZone}  onChange={(e) => setNewZone(e.target.value)}  style={inp} />
                <input placeholder="Route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} style={inp} />
              </div>
            </div>

            {createError && (
              <p style={{ color: "red", fontSize: 12, margin: "6px 0" }}>{createError}</p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={handleCreateRoute}
                disabled={creating}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                {creating ? "Saving..." : "Save Location"}
              </button>
              <button
                type="button"
                onClick={() => { setCreatingRoute(false); setCreateError(""); }}
                style={{ background: "none", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}
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

// Small inline lock icon shown next to locked field labels
function LockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94a3b8"
      strokeWidth={2.5}
      strokeLinecap="round"
      style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  );
}

const lbl = {
  display: "block",
  fontSize: 12,
  color: "#475569",
  marginBottom: 4,
  fontWeight: 500,
};

const inp = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
};

const star = {
  color: "#dc2626",
  fontWeight: 600,
};