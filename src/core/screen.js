import { MOBILE } from './env.js?v=__BUILD__';
// full screen is the price of entry on desktop: leave it and the bay waits for you
export const canFull = !MOBILE && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
export const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export const fullscreen = { pending: false };   // asked for, not yet granted or refused (an object, so the event handlers elsewhere can settle it)
export const goFull = () => { const el = document.documentElement, settle = () => { fullscreen.pending = false; }; fullscreen.pending = true;
  try { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r?.then) r.then(settle, settle); } catch { settle(); } };   // older Safari has no promise: the change and error events settle it   
// phones play sideways. Android can be locked there once it is full screen; an iPhone can't, so upright it gets a card asking you to turn it
export const portrait = () => MOBILE && innerHeight > innerWidth;
export const lockLandscape = () => { try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch {} };
export const goLandscape = () => { if (isFull()) lockLandscape(); else goFull(); };
