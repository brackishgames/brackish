// What we're running on and how: a phone or not, your own machine or not, and the dev and test modes only your machine has.
export const MOBILE = matchMedia('(pointer: coarse)').matches;
export const LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname), QS = new URLSearchParams(location.search);
export const DEV = LOCAL && QS.has('dev');   // dev mode only exists on your own machine; the published game ignores ?dev, which opens every place and body
// ?test: the world stands still until a test steps it (window.__game), nothing is fetched from outside, nothing is saved
export const TEST = LOCAL && QS.has('test');
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;   // then shake and flash start off
