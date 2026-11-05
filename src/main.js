// three.js and the pure-logic modules arrive as ES modules; the game itself is ordered plain scripts in src/, sharing one
// scope, run in this order. Everything here is handed to them as globals.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';   // stamped by the deploy, so a visitor never gets a mix of old and new files
// the module layers, lowest first. each module imports what it uses (tools/imports.mjs writes those lines)
const MODULES = ['lib/rng', 'lib/geo', 'lib/text', 'lib/tiff', 'lib/dem', 'lib/tilt', 'lib/save', 'lib/collide', 'lib/feedback',
  'core/env', 'core/random', 'core/tune', 'core/events', 'core/settings', 'core/screen', 'core/space',   // what everything stands on
  'render/display', 'render/materials', 'render/effects',                                 // the dot-matrix display and what draws on it
  'world/time', 'world/geo', 'world/seafloor', 'world/structures', 'world/seabed',                       // the bay: its depths and data, its floor, what is built in it, what grows on it
  'actors/creatures', 'actors/player', 'actors/wildlife', 'actors/fever', 'actors/life', 'actors/boats',   // what swims in it, and what floats on it
  'systems/input', 'systems/audio', 'systems/save', 'systems/story'];   // what you do, what you hear, what is kept, what happens
const mods = await Promise.all(MODULES.map(m => import(`./${m}.js?v=${BUILD}`)));
Object.assign(window, { THREE, EffectComposer, ShaderPass, UnrealBloomPass, mergeGeometries, BUILD });
// the game scripts below still share one scope while they move to modules: each export reaches them as a live, read-only
// global, so a value the module changes later is the value they see, and a script that tries to assign one fails loudly
for (const ns of mods) for (const name of Object.keys(ns)) Object.defineProperty(window, name, { get: () => ns[name], configurable: true, enumerable: true });
const GAME = ['04-logo.js', '10-hud.js', '13-frame.js', '14-panel.js', '15-touch.js', '16-test.js', '17-feedback.js', '18-boot.js'];
for (const f of GAME) { const el = document.createElement('script'); el.src = `src/${f}?v=${BUILD}`; el.async = false; document.body.append(el); }
