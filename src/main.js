// The game: every file is an ES module, imported in layer order, lowest first; then the bay is booted.
// Each module imports what it uses (tools/imports.mjs writes those lines from what the code reads).
const MODULES = ['lib/rng', 'lib/units', 'lib/geo', 'lib/text', 'lib/tiff', 'lib/dem', 'lib/tilt', 'lib/save', 'lib/collide', 'lib/feedback',   // pure logic: no game state, unit-tested
  'core/env', 'core/random', 'core/tune', 'core/events', 'core/settings', 'core/screen', 'core/space',   // what everything stands on
  'render/display', 'render/materials', 'render/effects',                                 // the dot-matrix display and what draws on it
  'world/time', 'world/geo', 'world/seafloor', 'world/bridges', 'world/structures', 'world/seabed',        // the bay: its hour, depths and data, floor, what is built in it, what grows on it
  'actors/creatures', 'actors/player', 'actors/wildlife', 'actors/fever', 'actors/life', 'actors/boats',   // what swims in it, and what floats on it
  'systems/input', 'systems/audio', 'systems/save', 'systems/story',                      // what you do, what you hear, what is kept, what happens
  'ui/hud', 'ui/panel', 'ui/logo', 'ui/touch', 'ui/feedback',                              // everything on screen
  'app/specimens', 'app/frame', 'app/testing', 'app/boot'];                                                // the loop, the test interface, and starting up
const BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';   // stamped by the deploy, so a visitor never gets a mix of old and new files
const mods = {};
for (const m of MODULES) mods[m] = await import(`./${m}.js?v=${BUILD}`);   // one at a time, in order: each layer is ready before the next starts
// on your own machine (?test, ?dev), every module's exports are reachable from the console and from tests, live and read-only
if (mods['core/env'].TEST || mods['core/env'].DEV) {
  window.THREE = await import('three');
  for (const ns of Object.values(mods)) for (const name of Object.keys(ns)) Object.defineProperty(window, name, { get: () => ns[name], configurable: true, enumerable: true });
}
mods['app/boot'].boot().catch(e => { console.error(e); mods['ui/feedback'].logError('boot: ' + (e?.stack || e)); });
