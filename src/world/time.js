// The time of day, in hours: it moves the sun and moon, decides who hunts and when the gigging lights come out, and is saved.
export const day = { hour: 6.5 };
export const clockText = h => { const m = Math.floor(((h % 1) + 1) % 1 * 60), hr = Math.floor(h) % 24; return `${hr % 12 || 12}:${String(m).padStart(2, '0')} ${hr < 12 ? 'AM' : 'PM'}`; };   // the hour, as you would say it
export const isNight = () => day.hour < 5.8 || day.hour > 19.5;
