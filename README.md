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

The story runs twelve chapters and you get a new body in most of them: cownose ray, bottlenose dolphin,
goliath grouper, bull shark, manatee, loggerhead, great hammerhead, manta. After the last chapter you can
swim anywhere as any of them. Sharks hunt you when you're small. Ships shove you aside with their bow wave
and churn the water for ninety metres behind them. The tide runs through the pass. The sun comes up.

Press Enter and the game goes full screen. W and S swim forward and back, A and D turn, Space rises and C dives (the arrow keys work too). Shift is a
burst of speed. E is your animal's ability: a ray senses the electric field of living things around it, a
dolphin echolocates, a shark strikes, a stingray settles into the sand and goes unseen, a turtle or manatee
takes a breath. Tab cycles the creatures you have already been, M opens the map for fast travel between places
you've found, and H shows the help. On a phone, drag anywhere to swim and use the round buttons.

To run it locally, open `index.html` in Chrome. There is no build step. three.js loads from a CDN.
Every push to `main` deploys the site through the workflow in `.github/workflows`.


Depths are NOAA NCEI soundings. Tide, water temperature and tidal currents come live from NOAA CO-OPS (St. Petersburg and 15 current stations). Add `?dev` to the URL to open every place and body for exploring; dev mode never touches your save.
