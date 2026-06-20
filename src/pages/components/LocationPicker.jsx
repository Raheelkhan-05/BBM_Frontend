import { useState } from "react";

export default function LocationPicker({
  country,
  state,
  city,
  zone,
  route,
  onChange,
  useRoutesHook,
  errors = {}
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
    errors[name] ? <p style={{ color: "#f43f5e", fontSize: 11, marginTop: 3 }}>{errors[name]}</p> : null;

  const [creatingRoute, setCreatingRoute] = useState(false);

  const [newCountry, setNewCountry] = useState("");
  const [newState, setNewState] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newZone, setNewZone] = useState("");
  const [newRoute, setNewRoute] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const filteredStates = country ? states(country) : [];

  const filteredCities =
    country && state
      ? cities(country, state)
      : [];

  const filteredZones =
    country && state && city
      ? zones(country, state, city)
      : [];

  const filteredRoutes =
    country && state && city && zone
      ? routeNames(country, state, city, zone)
      : [];

  function handleCountry(e) {
    onChange("country", e.target.value);
    onChange("state", "");
    onChange("city", "");
    onChange("zone", "");
    onChange("route", "");

    console.log("countries", countries);
console.log("country", country);

console.log("filteredStates", filteredStates);
console.log("state", state);

console.log("filteredCities", filteredCities);
  }

  function handleState(e) {
    onChange("state", e.target.value);
    onChange("city", "");
    onChange("zone", "");
    onChange("route", "");
  }

  function handleCity(e) {
    onChange("city", e.target.value);
    onChange("zone", "");
    onChange("route", "");
  }

  function handleZone(e) {
    onChange("zone", e.target.value);
    onChange("route", "");
  }

  function handleRoute(e) {
    onChange("route", e.target.value);
  }

  async function handleCreateRoute() {
    if (
      !newCountry.trim() ||
      !newState.trim() ||
      !newCity.trim() ||
      !newZone.trim() ||
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
      onChange("state", newState.trim());
      onChange("city", newCity.trim());
      onChange("zone", newZone.trim());
      onChange("route", newRoute.trim());

      setCreatingRoute(false);

      setNewCountry("");
      setNewState("");
      setNewCity("");
      setNewZone("");
      setNewRoute("");
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  const sel = (value, handler, options, placeholder) => (
    <select
      value={value}
      onChange={handler}
      style={{
        width: "100%",
        padding: "7px 10px",
        border: "1px solid #cbd5e1",
        borderRadius: 6,
        fontSize: 13,
        background: "#fff",
      }}
    >
      <option value="">{placeholder}</option>

      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

  {/* Row 1 */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    }}
  >
    <div>
      <label style={lbl}>Country <span style={star}>*</span></label>
      {sel(country, handleCountry, countries, "Select Country")}
      <FieldError name="country" />
    </div>

    <div>
      <label style={lbl}>State <span style={star}>*</span></label>
      {sel(
        state,
        handleState,
        filteredStates,
        country ? "Select State" : "Select Country First"
      )}
      <FieldError name="state" />
    </div>
  </div>

  {/* Row 2 */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 10,
    }}
  >
    <div>
      <label style={lbl}>City <span style={star}>*</span></label>
      {sel(
        city,
        handleCity,
        filteredCities,
        state ? "Select City" : "Select State First"
      )}
      <FieldError name="city" />
    </div>

    <div>
      <label style={lbl}>Zone <span style={star}>*</span></label>
      {sel(
        zone,
        handleZone,
        filteredZones,
        city ? "Select Zone" : "Select City First"
      )}
      <FieldError name="zone" />
    </div>

    <div>
      <label style={lbl}>Route <span style={star}>*</span></label>
      {sel(
        route,
        handleRoute,
        filteredRoutes,
        zone ? "Select Route" : "Select Zone First"
      )}
      <FieldError name="route" />
    </div>
  </div>

</div>

      {!creatingRoute ? (
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
          }}
        >
          + Location not listed? Add new
        </button>
      ) : (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            marginTop: 8,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              fontWeight: 600,
              color: "#475569",
            }}
          >
            ADD NEW LOCATION
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Country + State */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <input
                placeholder="Country"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                style={inp}
              />

              <input
                placeholder="State"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                style={inp}
              />
            </div>

            {/* City + Zone + Route */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <input
                placeholder="City"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                style={inp}
              />

              <input
                placeholder="Zone"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                style={inp}
              />

              <input
                placeholder="Route"
                value={newRoute}
                onChange={(e) => setNewRoute(e.target.value)}
                style={inp}
              />
            </div>

          </div>

          {createError && (
            <p
              style={{
                color: "red",
                fontSize: 12,
                margin: "0 0 8px",
              }}
            >
              {createError}
            </p>
          )}

          <div className="mt-5" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleCreateRoute}
              disabled={creating}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {creating ? "Saving..." : "Save Location"}
            </button>

            <button
              type="button"
              onClick={() => {
                setCreatingRoute(false);
                setCreateError("");
              }}
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
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