import { useState } from "react";

export default function LocationPicker({ city, zone, route, onChange, useRoutesHook }) {
  const { cities, zones, routeNames, createRoute } = useRoutesHook;
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newZone, setNewZone] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const filteredZones = city ? zones(city) : [];
  const filteredRoutes = city && zone ? routeNames(city, zone) : [];

  function handleCity(e) {
    onChange("city", e.target.value);
    onChange("zone", "");
    onChange("route", "");
  }
  function handleZone(e) {
    onChange("zone", e.target.value);
    onChange("route", "");
  }
  function handleRoute(e) { onChange("route", e.target.value); }

  async function handleCreateRoute() {
    if (!newCity.trim() || !newZone.trim() || !newRoute.trim()) {
      setCreateError("All three fields required"); return;
    }
    setCreating(true); setCreateError("");
    try {
      await createRoute(newCity.trim(), newZone.trim(), newRoute.trim());
      onChange("city", newCity.trim());
      onChange("zone", newZone.trim());
      onChange("route", newRoute.trim());
      setCreatingRoute(false);
      setNewCity(""); setNewZone(""); setNewRoute("");
    } catch (e) { setCreateError(e.message); }
    finally { setCreating(false); }
  }

  const sel = (val, onChange_, opts, placeholder) => (
    <select value={val} onChange={onChange_}
      style={{ width: "100%", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "#fff" }}>
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
        <div>
          <label style={lbl}>City</label>
          {sel(city, handleCity, cities, "— Select City —")}
        </div>
        <div>
          <label style={lbl}>Zone</label>
          {sel(zone, handleZone, filteredZones, city ? "— Select Zone —" : "— Select City first —")}
        </div>
        <div>
          <label style={lbl}>Route</label>
          {sel(route, handleRoute, filteredRoutes, zone ? "— Select Route —" : "— Select Zone first —")}
        </div>
      </div>

      {/* Create new route inline */}
      {!creatingRoute ? (
        <button type="button" onClick={() => setCreatingRoute(true)}
          style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0 }}>
          + Location not listed? Add new
        </button>
      ) : (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginTop: 4 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#475569" }}>ADD NEW LOCATION</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input placeholder="City" value={newCity} onChange={(e) => setNewCity(e.target.value)} style={inp} />
            <input placeholder="Zone" value={newZone} onChange={(e) => setNewZone(e.target.value)} style={inp} />
            <input placeholder="Route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)} style={inp} />
          </div>
          {createError && <p style={{ color: "red", fontSize: 12, margin: "0 0 6px" }}>{createError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleCreateRoute} disabled={creating}
              style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              {creating ? "Saving…" : "Save Location"}
            </button>
            <button type="button" onClick={() => { setCreatingRoute(false); setCreateError(""); }}
              style={{ background: "none", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 };
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };