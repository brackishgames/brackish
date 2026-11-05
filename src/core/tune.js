// the numbers that decide how the game feels, in one place
export const TUNE = {
  burst: { secs: 5, refill: 6, boost: 2.2, reuseAt: 0.3 },   // seconds of turbo, seconds to refill from empty, top speed over the real sprint, fill needed to go again
  shadow: { first: [50, 90], every: [70, 160], retry: 10 },  // seconds until something large crosses your path; sooner again if it couldn't
  fail: { from: 12, to: 26 },                                // metres down where the display starts, and finishes, losing segments
  hush: 0.88,                                                // how much of the sea goes quiet when a shark takes an interest
  tide: { pull: 0.9, from: 0.3, to: 1.0 },                   // strong currents push this much harder, ramping in between these m/s
  thing: { chance: 0.3, every: [240, 480], floor: 10 },      // the echo's unnamed shape: odds per echo, seconds between, minimum depth below you
  timing: {   // how long things last on purpose. never how long to wait for something else: that is always an event
    cardHold: 1.0,                  // a chapter's title, before its first line takes over
    resumeCard: 0.6,                // the title again when you continue a save
    endingFirst: 2.5, endingCard: 3.6,   // the ending: a breath before the first card, then each card
    hitFlash: 0.18, respawn: 2.5,   // the edge flash when hurt; the quiet before you wake at the checkpoint
    echoReach: 0.45,                // when the echo's ring reaches the thing in the dark
    hintFor: 25,                    // the key hints at the start of a swim
    hudIn: [0.6, 3.0],              // the HUD eases in between these seconds after you start
    autosave: 30,                   // world seconds between saves as you swim
  },
  guards: { storageMs: 2000, liveMs: 15000, osmMs: 30000 },   // give up on a slow service after this long: a failure, never a wait
};
