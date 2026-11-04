'use strict';
const MOBILE = matchMedia('(pointer: coarse)').matches;
const DEV = (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) && new URLSearchParams(location.search).has('dev');   // dev mode only exists on your own machine; the published game ignores ?dev
// settings live in this browser only; everything works without them
const settings = (() => { const d = { volume: 8, turn: 100, shake: true, flash: true, bigText: false, tips: {} }; try { return { ...d, ...JSON.parse(localStorage.getItem('brackish.settings') || '{}') }; } catch { return d; } })();
const saveSettings = () => { try { localStorage.setItem('brackish.settings', JSON.stringify(settings)); } catch {} };
// full screen is the price of entry on desktop: leave it and the bay waits for you
const canFull = !MOBILE && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const goFull = () => { const el = document.documentElement; try { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); r?.catch?.(() => {}); } catch {} };   // ?dev opens every place and body for exploring
