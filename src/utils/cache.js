// src/utils/cache.js
export function bustDashboardCache() {
  Object.keys(sessionStorage)
    .filter(k => k.startsWith("dashboard_cache"))
    .forEach(k => sessionStorage.removeItem(k));
}