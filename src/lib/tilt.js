// Phone tilt → steering. The world's up direction, first in the device's frame (from W3C beta/gamma), then in the screen's
// (x right, y up, z out of the glass) for whichever way the screen is turned.
export function screenUp(betaDeg, gammaDeg, angleDeg) {
  const b = betaDeg * Math.PI / 180, g = gammaDeg * Math.PI / 180, dx = -Math.sin(g) * Math.cos(b), dy = Math.sin(b), uz = Math.cos(g) * Math.cos(b);
  const a = (((angleDeg % 360) + 360) % 360) * Math.PI / 180;
  return { ux: dx * Math.cos(a) - dy * Math.sin(a), uy: dx * Math.sin(a) + dy * Math.cos(a), uz };
}
// lean: + when the left edge is down (turn left). pitch: grows as the top tips away from you.
export function tiltAngles(betaDeg, gammaDeg, angleDeg) {
  const { ux, uy, uz } = screenUp(betaDeg, gammaDeg, angleDeg);
  return { lean: Math.asin(Math.max(-1, Math.min(1, ux))), pitch: Math.atan2(uz, uy) };
}
// a dead zone, then a linear reach to full
export const ramp = (v, dead, full) => Math.sign(v) * Math.max(0, Math.min(1, (Math.abs(v) - dead) / (full - dead)));
