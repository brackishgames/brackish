// the numbers that decide how the game feels, in one place
export const TUNE = {
  burst: { secs: 5, refill: 6, boost: 2.2, top: 12, reuseAt: 0.3 },   // seconds of turbo, seconds to refill from empty, top speed over the real sprint, and the most that can ever be (m/s: fast animals would otherwise pass 40 mph), fill needed to go again
  leap: { near: 1.4, every: 1.6, kick: 5 },                  // a dolphin's leap: how close to the top a burst lifts you out (m), how often while you hold it (s), how hard (m/s)
  shadow: { first: [50, 90], every: [70, 160], retry: 10 },  // seconds until something large crosses your path; sooner again if it couldn't
  fail: { from: 12, to: 26 },                                // metres down where the display starts, and finishes, losing segments
  hush: 0.88,                                                // how much of the sea goes quiet when a shark takes an interest
  tide: { pull: 0.9, from: 0.3, to: 1.0 },                   // strong currents push this much harder, ramping in between these m/s
  photo: { reach: 40, lens: [25, 90], shutter: 0.25, hint: 6 },   // photo mode: how far (m) the lens may wander from you, its field of view, the shutter's blink (s), how long the keys stay on screen (s)
  camera: { near: 0.8, perSize: 1.32, perSpeed: 0.04 },        // how far behind you: a base, per metre of body, per m/s. tools/check.mjs measures how much of the screen the animal fills
  // the sound, by the science. tools/check.mjs measures the result against what the ocean does, so these are tuned from numbers, not by ear
  sound: { swell: 0.1, shrimp: 0.05, pressure: 0.32, pressureDeep: 0.22, rough: 0.14, roughHz: 70, chorus: 1, ring: 3600, ringLevel: 0.02, ringFor: 5 },   // the sea breathes at 0.1 Hz (six breaths a minute, the calmest human rate); snapping shrimp; a sub-bass pressure near a hunter, and a little in deep water; the alarm of 30-150 Hz roughness (Arnal et al. 2015) at this rate; fish at dusk
  water: { glow: 0.09, fade: 0.06, bottomFade: 0.22, bottomSeen: 11 },                          // what distance fades to under water: how bright just under a noon surface, and how fast that goes with depth (per metre, as the light does); how fast the seafloor is lost as you rise from it (per metre), and how far off it (m) the readout stops knowing
  // the quiet HUD: each part comes up when it has something to tell you, and goes down `linger` seconds after it last did
  hud: { linger: 4, rise: 6, fall: 0.8,                      // seconds it stays; how fast it comes up and goes (per second)
    chapterShow: 20, speedStep: 0.5, offGoal: 25, farGoal: 800,  // all of it, the first seconds of a chapter; a speed change worth showing (M/S); the goal this far off your nose (degrees) brings the compass, this far away (M) the chart
    sinking: 0.4, nearFloor: 1.5, airShow: 0.5 },             // rising or sinking this fast (M/S) brings the depth, as does the floor this close (M); air below this shows, and the edges close in
  thing: { chance: 0.3, every: [240, 480], floor: 10 },      // the echo's unnamed shape: odds per echo, seconds between, minimum depth below you
  fever: { behind: 35, rejoin: 300 },                        // metres: where a chapter that follows the fever puts you (behind its middle); how far off a saved game may have left you before it puts you back
  timing: {   // how long things last on purpose. never how long to wait for something else: that is always an event
    toBlack: 0.9,                   // a new chapter: the screen goes to black, then the world changes, on the world's clock
    cardHold: 1.0,                  // a chapter's title, before its first line takes over
    resumeCard: 0.6,                // the title again when you continue a save
    endingFirst: 2.5, endingCard: 3.6,   // the ending: a breath before the first card, then each card
    hitFlash: 0.18, respawn: 2.5,   // the edge flash when hurt; the quiet before you wake at the checkpoint
    echoReach: 0.45,                // when the echo's ring reaches the thing in the dark
    hintFor: 25,                    // the key hints at the start of a swim
    hudIn: [0.6, 3.0],              // the HUD eases in between these seconds after you start
    autosave: 30,                   // world seconds between saves as you swim
  },
  guards: { weatherMs: 900000, storageMs: 2000, liveMs: 15000, osmMs: 30000 },   // give up on a slow service after this long: a failure, never a wait
};
