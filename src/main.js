// three.js and the pure-logic modules arrive as ES modules; the game itself is ordered plain scripts in src/, sharing one
// scope, run in this order. Everything here is handed to them as globals.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BUILD = new URL(import.meta.url).searchParams.get('v') || 'dev';   // stamped by the deploy, so a visitor never gets a mix of old and new files
const LIBS = ['rng', 'geo', 'text', 'tiff', 'dem', 'tilt', 'save', 'collide', 'feedback'].map(n => `./lib/${n}.js`);
const CORE = ['env', 'random', 'tune', 'events', 'settings', 'screen'].map(n => `./core/${n}.js`);   // what everything stands on: src/core/
const mods = await Promise.all([...LIBS, ...CORE].map(p => import(`${p}?v=${BUILD}`)));
Object.assign(window, { THREE, EffectComposer, ShaderPass, UnrealBloomPass, mergeGeometries, BUILD }, ...mods);   // the game scripts below still share one scope; modules reach them this way
const GAME = ['01-geo.js', '02-render.js', '03-creatures.js', '04-logo.js', '05-structures.js', '06-wildlife.js', '07-boats.js', '08-input.js',
  '09-audio.js', '10-hud.js', '11-save.js', '12-story.js', '13-frame.js', '14-panel.js', '15-touch.js', '16-test.js', '17-feedback.js', '18-boot.js'];
for (const f of GAME) { const el = document.createElement('script'); el.src = `src/${f}?v=${BUILD}`; el.async = false; document.body.append(el); }
