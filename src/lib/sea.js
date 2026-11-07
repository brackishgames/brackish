// The sea's own arithmetic, and reading the real weather. Pure, so it can be tested.
const G = 9.81, BAY_FETCH = 20000;   // how far wind can run across open water here, in metres
// waves from wind and the distance it has blown over (fetch-limited growth, JONSWAP form): significant height (m) and peak period (s)
export function seaState(windMs, fetch = BAY_FETCH) { const u = Math.max(windMs, 0.1), x = G * fetch / (u * u); return { height: Math.min(0.0016 * Math.sqrt(x) * u * u / G, 0.2433 * u * u / G), period: Math.min(0.286 * Math.cbrt(x) * u / G, 8.13 * u / G) }; }
// a wave's length from its period, in deep water: omega^2 = g k
export const waveNumber = period => (2 * Math.PI / period) ** 2 / G;
const COVER = { CLR: 0, SKC: 0, FEW: 0.2, SCT: 0.4, BKN: 0.7, OVC: 1, VV: 1 };
// one NWS station observation (api.weather.gov) into the few things the bay cares about
export function readObservation(p) {
  const wx = p.presentWeather || [], wet = wx.find(w => /rain|drizzle|thunder|shower/i.test(w.weather || '')), amount = p.precipitationLastHour?.value, kmh = p.windSpeed?.value;
  const rain = wet ? ({ light: 0.3, heavy: 1 }[wet.intensity] ?? 0.6) : amount > 0 ? Math.min(1, 0.2 + amount / 8) : 0;
  return { rain, cloud: Math.max(0, ...(p.cloudLayers || []).map(l => COVER[l.amount] ?? 0)), wind: kmh != null ? kmh / 3.6 : 0, windDir: p.windDirection?.value ?? 0, text: p.textDescription || '', air: p.temperature?.value ?? null };
}
