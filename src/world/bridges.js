// The bay's bridges, measured. Where a figure is published it is cited; where none was found it is an estimate, and says so.
// OpenStreetMap gives each bridge's path (18-boot.js); these give its heights.

// The Sunshine Skyway (1987), cable-stayed main bridge with long high-level approaches and low trestles on the causeways.
//   Structurae: https://structurae.net/en/structures/sunshine-skyway-bridge   Wikipedia: https://en.wikipedia.org/wiki/Sunshine_Skyway_Bridge
export const SKYWAY_SPEC = {
  mainSpan: 366.75,                      // m, between the pylons (Structurae)
  sideSpan: 164.6,                       // m, each side of the main span (Structurae)
  backSpans: [73.2, 73.2, 73.2, 42.7],   // m, then these each side, out to the end of the main bridge, 1,219.6 m long in all (Structurae)
  deckWidth: 28.95, deckDepth: 4.3,      // m (Structurae)
  clearance: 55,                         // m (180 ft) under the main span (Wikipedia; FDOT gives 175 to 180 ft with the tide)
  pylonTop: 131,                         // m (430 ft) above the water (Wikipedia)
  pylonAlong: [7.0, 4.3], pylonAcross: 3.3,   // m, the pylon above the deck, tapering along the bridge (Structurae)
  cables: 42,                            // in one plane down the middle, a semi-fan, painted yellow (Wikipedia, Structurae)
  // estimates, no published figure found: the approach grade, approach pier spacing and column size, and the trestles
  grade: 0.04, approachPier: 42.7, column: [4.5, 7], trestleUnderside: 4, bent: 18,
};
// The other crossings: low trestles that rise to a navigation clearance over the channel. Clearances are the figures
// commonly given (Wikipedia's bridge pages; Courtney Campbell's is unconfirmed): treat them as approximate.
export const CLEARANCES = [['Howard Frankland', 13.4], ['Gandy', 13.1], ['Courtney Campbell', 12.2]];
export const TRESTLE = { underside: 4, deckWidth: 14, deckDepth: 1.6, grade: 0.04, bent: 18, pileR: 0.9, navHalf: 60 };   // estimates
export const isSkyway = name => /skyway/i.test(name || '');
export const clearanceOf = name => (CLEARANCES.find(([n]) => (name || '').includes(n)) || [null, TRESTLE.underside + 2])[1];
// the Skyway's deck underside at `s` metres along it from the middle of the main span
export function skywayUnderside(s) {
  const S = SKYWAY_SPEC, a = Math.abs(s) - S.mainSpan / 2;
  return a <= 0 ? S.clearance : Math.max(S.trestleUnderside, S.clearance - S.grade * a);
}
// the main bridge's pier stations, out from the middle: the pylons, then the ends of the side and back spans
export function skywayStations() {
  const S = SKYWAY_SPEC, out = [S.mainSpan / 2]; let s = S.mainSpan / 2 + S.sideSpan; out.push(s);
  for (const span of S.backSpans) { s += span; out.push(s); }
  return out;   // [183.4 (pylon), 348, 421.2, 494.4, 567.6, 610.3]
}
