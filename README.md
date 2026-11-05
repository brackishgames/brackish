# Brackish

Play it at https://brackishgames.github.io/brackish/

<img src="screenshots/hole.png" alt="A young cownose ray in the dark water off Egmont Key, a large animal looming out of the dark to the left" width="100%">

<img src="screenshots/surface.png" alt="Just under the surface at Egmont Key, seagrass below" width="100%">

<img src="screenshots/map.png" alt="Fast travel: places down the bay beside a dot-matrix chart" width="100%">

You are an animal in Tampa Bay. The whole thing is drawn the way the old Pioneer car stereos drew
their dolphin screensaver: cyan and blue dots on black, pale readouts lit on the same grid.

## The bay

The bay is real and to scale. One unit is one metre. Depths come from the NOAA NCEI DEM mosaic, which the page
downloads the first time it runs and keeps in the browser after that. The ship channel is 12.5 m, the hole off the
north tip of Egmont Key is 25 m, and the Gulf reaches 30 m about 50 km out. Tide, water temperature and tidal currents
come live from NOAA CO-OPS (St. Petersburg and 15 current stations). Bridges are pulled from OpenStreetMap, with the
Skyway, Gandy, Howard Frankland and Courtney Campbell built in for when that request fails. Each place you reach for
the first time tells you one true thing about it: the Skyway in 1980, the Blackthorn, Fort Dade, Big Bend's warm water.

## The story

Nine chapters across four bodies, each moving at the real animal's speed: a cownose ray finds the fever off Egmont and
follows it into the Gulf; a bottlenose dolphin swims beside one of its pod and leaps with it; a bull shark feeds in
Hillsborough Bay at night; a manatee makes for the warm water at Apollo Beach. Then you are the ray again, in the pass
where you began, at dawn. After that you can swim anywhere as any of them.

The bay is not on your side. A shark that finds a ray alone, or at the ragged edge of the fever, stays on you until you
lose it: get far away, or deep into the fever. Hammerheads follow the migration and pin rays to the sand. Hulls hit the
top few metres and their wash throws you about astern; you hear a ship's slow thrum long before you see it. At night,
giggers pole the flats with a light on the bottom, and in the light you shine. Dolphins and manatees need air.

## Playing

Press Enter or click and the game goes full screen and takes the mouse. Move the mouse to steer, W and S (or ↑ ↓) swim
faster and slower, A and D (or ← →) turn, Space rises and C dives, and hold the right button to look around. Let go of a
rise or a dive and the nose comes back level. Shift is a burst: five seconds flat out, at a little over twice the animal's
real sprint, back in about two. Strong tide is something else: it carries you, and the readout says TIDE and which way. E is the ability: a ray senses clams buried in the sand, a dolphin
echolocates, a shark lunges, a manatee takes a breath. Tab cycles the bodies you have been and M opens the map for fast
travel. Esc or P pauses: settings, the journal of places you've found, restart the chapter, or start a new game.

A controller works over USB or Bluetooth (Xbox, PlayStation, Switch Pro): left stick steers, RT swims, A bursts, X is the
ability, the right stick looks around, START pauses. A phone plays sideways: tilt it like a wheel to turn, tip the top away
to dive or toward you to rise, and hold a thumb anywhere to burst (TILT STEERING in settings turns tilt off for a drag
stick). F, or *Send feedback* in the pause menu, sends us a note from where you are.

At the top left, DOWN is how deep you are and FLOOR is the bottom under you; the gauge below them shows you between the
surface and the seafloor. Clams give a heart back, and a well-fed animal carries up to five. At a moment worth keeping
(a wreck or landmark close by, inside the fever, a leap together, the surface at dawn) a prompt appears and O opens photo
mode: the bay stops, the screen clears, and Enter saves a picture.

Settings cover volume (with ambience and effects apart), every key (CONTROLS), mouse speed, invert Y, turn speed, large
text, opt-in crash reports and sound captions, which show the sounds that matter (an engine, a shark's pressure wave, fish scattering)
on the side they came from. COMFORT holds what keeps the camera from making anyone queasy: field of view, horizon tilt,
camera sway, speed effects, a comfort vignette that steadies the edges in fast motion, screen shake, hit flash, and
flicker (never faster than 2.5 changes a second, and none when off). If your system asks for reduced motion, they all
start gentle. The game saves as you go and picks up where you left off.

## Running it locally

`node tools/serve.mjs` and open `localhost:8000`: it tells the browser never to keep an old copy, so an edit always
shows. There is no build step and nothing loads from anyone else's servers: three.js is in `vendor/` and the depths are in
`data/`. The live tide, temperature and currents still come from NOAA, and the bridges from OpenStreetMap, but the game
plays without them. On your own machine `?dev` opens every place and body, `?dev&clock=22` sets the hour, F3 shows the
world's state and `[` `]` slow time down or speed it up; `?seed=7` replays a run exactly. The published site ignores all
of that, and dev mode never touches your save. The page's security policy allows only this site and those data services.

## Testing

`npm install` once, then `npm test`: lint, unit tests, and the game played by a script.

- `npm run lint` lints the game's scripts joined in load order, the only way to catch a name no file defines.
- `npm run test:unit` covers the pure logic in `src/lib/` (map frame, depths format, text wrap, tilt, saves, collision,
  feedback reports) and the feedback Worker.
- `npm run test:game` opens the game in headless Chrome at `?test`, where the world only moves when a test steps it, and
  plays it: cruising, the burst, levelling out, turning, the tide, running into a pier, pausing, comfort settings,
  feedback, rebinding, the shapes in the murk, deep water, the echo, a controller, and a phone held both ways. Nothing in a
  test sleeps: it waits for the game's own events or for a condition to come true. `node tests/game.mjs burst` runs one.

`window.__game` (in `?test` and `?dev`) is the whole interface: `start()`, `setInput({ turn, climb, throttle, burst })`,
`step(frames)`, `state()`, `teleport(lat, lon, depth)`. Every pull request and every deploy runs all of it
(`.github/workflows/test.yml`); nothing ships that fails.

## Feedback

The game files feedback as GitHub issues, with the note and what the game knew at that moment. Out of the box it opens a
filled-in new-issue page; deploy the small Worker in `tools/feedback-worker/` (its README has the four steps) and it posts
straight from the game.

## Releases

The game is in beta, and every release is a pre-release: `v0.1.0-beta.1`, `v0.1.0-beta.2`, and on. [release-please](https://github.com/googleapis/release-please)
reads the commit messages on `main` and keeps one release PR open with the next version and its changelog; merging it
tags the release and stamps the version into `index.html`, where the title screen shows it. Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/): `feat: …` for something new, `fix: …` for a repair,
anything else (`docs:`, `chore:`, `refactor:`) stays out of the changelog. To leave beta, set `"versioning": "default"`
and drop `"prerelease"` in `release-please-config.json`, then commit with a `Release-As: 1.0.0` footer.

## Code

`index.html` holds the markup and styles; `src/main.js` loads three.js, the pure-logic modules in `src/lib/` and the core in
`src/core/` (`env`, `random`, `tune`, `events`, `settings`, `screen`: what everything stands on), `src/render/` (`display`:
the renderer and the dot-matrix post; `materials`: the shared shading and the animated body material; `effects`: sky,
water, light shafts and particles) and `src/world/` (`geo`: the real-world frame, the depths, NOAA and the `Bay` API;
`seafloor`; `structures`; `seabed`). Each module imports what it uses, and `npm run imports` writes those lines from what
the code actually reads. The rest of the game is still plain scripts in `src/`, run in order and sharing one scope while
they move to modules a layer at a time: `03-creatures` (species and bodies), `04-logo`,
`06-wildlife` (wild animals, the fever, food, mullet shoals), `07-boats` (boats and giggers), `08-input`
(the input snapshot, keys and bindings, mouse, controller, pause menu, photo mode), `09-audio`, `10-hud`, `11-save`,
`12-story`, `13-frame` (world steps and the frame, the player, the camera), `14-panel` (the dot font and every word on
screen), `15-touch` (touch and tilt), `16-test` (the test interface and the dev readout), `17-feedback` and `18-boot`.
The world moves in fixed slices of time and every roll goes through one seeded `rand()`; the numbers that decide how it
feels, and how long things last, are in `TUNE` in `src/core/tune.js`. Nothing waits on a guess: a step that follows
another is called when that one has happened (a fade reaching black, a chapter begun, full screen granted). A name declared
twice across files stops the game at load, which is on purpose.

`tools/fetch-dem.mjs` fetches the depths from NOAA again (only if the tile bounds change), `tools/vendor-three.mjs`
copies a three.js version into `vendor/`, and `tools/marks.py` redraws the logo, org avatar and share card in `brand/`.
