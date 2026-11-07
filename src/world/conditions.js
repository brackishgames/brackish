import * as THREE from 'three';
import { readObservation, seaState } from '../lib/sea.js?v=__BUILD__';
import { mph } from '../lib/units.js?v=__BUILD__';
import { emit, events } from '../core/events.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { WU } from '../render/materials.js?v=__BUILD__';
import { setTideLevel, within } from './geo.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  CONDITIONS  —  one source for what the bay is doing right now. The real feeds write here, the model page can overrule it,
//  and everything that cares (the sea's shape, the light, the sound, the depth under you) reads only this.
// ═══════════════════════════════════════════════════════════════════
export const ENV = { rain: 0, cloud: 0, wind: 3, windDir: 90, tide: 0, clarity: 0.5, text: '', live: false };
export function applyEnv(e = ENV) {   // onto the shaders
  const { height, period } = seaState(e.wind); WU.uChop.value = height; WU.uWavePeriod.value = period; const a = (e.windDir ?? 0) * Math.PI / 180; WU.uWindDir.value.set(-Math.sin(a), Math.cos(a)); WU.uRain.value = e.rain; const t = THREE.MathUtils.clamp(e.tide, -1.2, 1.2); WU.uTide.value = t; setTideLevel(t); WU.uCloud.value = e.cloud;
}
// the gauge reads above mean lower low water; the middle of St. Petersburg's small tide sits about a third of a metre over that
export const MEAN_TIDE = 0.35;
export function initConditions() { events.addEventListener('tide', e => { ENV.tide = e.detail - MEAN_TIDE; applyEnv(); }); applyEnv(); }
export const fogReach = e => THREE.MathUtils.lerp(1.6, 0.6, e.clarity);   // murky water closes in, clear water opens out
export const STATION = { id: 'KPIE', name: 'ST. PETE-CLEARWATER' };
export async function loadWeather() { const r = await within(TUNE.guards.liveMs, fetch(`https://api.weather.gov/stations/${STATION.id}/observations/latest`)); if (!r.ok) throw new Error('nws ' + r.status); Object.assign(ENV, readObservation((await r.json()).properties), { live: true }); applyEnv(); emit('weather'); }
export const weatherLine = () => { const dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((ENV.windDir || 0) / 45) % 8]; return `${ENV.rain > 0.5 ? 'HEAVY RAIN' : ENV.rain > 0 ? 'RAIN' : ENV.cloud > 0.6 ? 'OVERCAST' : 'CLEAR'} · WIND ${mph(ENV.wind).toFixed(0)} MPH ${dir}`; };
