# Brackish

Play it at https://brackishgames.github.io/brackish/

<img src="screenshots/hole.png" alt="A young cownose ray in the dark water off Egmont Key, something round looming in the dark to the left" width="100%">

<img src="screenshots/surface.png" alt="Just under the surface at Egmont Key, seagrass below" width="100%">

<img src="screenshots/map.png" alt="Fast travel: places down the bay beside a dot-matrix chart" width="100%">

You are an animal in Tampa Bay. The whole thing is drawn the way the old Pioneer car stereos drew
their dolphin screensaver: cyan and blue dots on black, pale readouts lit on the same grid.

The bay is real and to scale. One unit is one metre. Depths come from the NOAA NCEI DEM mosaic, which
the page downloads the first time it runs and keeps in the browser after that. The ship channel is 12.5 m,
the hole off the north tip of Egmont Key is 25 m, and the Gulf reaches 30 m about 50 km out. Bridges are
pulled from OpenStreetMap, with the Skyway, Gandy, Howard Frankland and Courtney Campbell built in for when
that request fails.

The story runs nine chapters across four bodies: a cownose ray, a bottlenose dolphin, a bull shark and a
West Indian manatee, each moving at the real animal's speed. You start as the ray and end as it. After the
last chapter you can swim anywhere as any of them. Sharks hunt a ray on its own; the fever hides you. Ships shove you aside with their bow wave
and churn the water for ninety metres behind them. The tide runs through the pass. The sun comes up.

Press Enter or click and the game goes full screen; leave full screen, or press P, to pause. W and S swim forward and back, A and D turn, Space rises and C dives (the arrow keys work too). Shift is a
burst of speed. E is your animal's ability: a ray senses the electric field of clams buried in the sand, a
dolphin echolocates, a shark strikes, a manatee takes a breath. A gamepad works too. Tab cycles the creatures you have already been, M opens the map for fast travel between places
you've found, and H shows the help. On a phone, drag anywhere to swim and use the round buttons.

To run it locally, open `index.html` in Chrome. There is no build step. three.js loads from a CDN.
Every push to `main` deploys the site through the workflow in `.github/workflows`.


Depths are NOAA NCEI soundings. Tide, water temperature and tidal currents come live from NOAA CO-OPS (St. Petersburg and 15 current stations). When you run it locally (localhost or the file itself), `?dev` opens every place and body and `?dev&clock=22` sets the hour; the published site ignores both, and dev mode never touches your save.

## Code

No build step. `index.html` holds the markup and styles and loads three.js as modules; the game is plain scripts in
`src/`, run in order and sharing one scope, one file per system: `00-config`, `01-geo` (the real-world frame, NOAA
data and the `Bay` API), `02-render` (renderer, dot-matrix post, seafloor, sky and water), `03-creatures`, `04-logo`,
`05-structures`, `06-wildlife` (wild animals, the fever, food, schools), `07-boats` (boats and giggers), `08-input`
(keys, pause menu, gamepad), `09-audio`, `10-hud`, `11-save`, `12-story`, `13-frame` (the main loop, the player,
the camera), `14-panel` (the dot font and every word on screen), `15-touch` and `16-boot`. A name declared twice
across files stops the game at load, which is on purpose. Serve the folder (`python3 -m http.server`) and open
`localhost:8000/?dev` to explore. `node tools/smoke.mjs` starts the game in headless Chrome against a server on port 18437 and fails on any
exception; the deploy refuses to ship a script that does not parse. `tools/marks.py` redraws the marks in `brand/`.

