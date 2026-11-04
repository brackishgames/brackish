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

Press Enter or click and the game goes full screen and takes the mouse. Move the mouse to steer, W and S swim forward and
back, Space rises and C dives (A and D and the arrows work too), and hold the right button to look around. Shift is a
burst, twenty seconds of the animal's real sprint. E is the ability: a ray senses clams buried in the sand, a dolphin
echolocates, a shark lunges, a manatee takes a breath. Tab cycles the bodies you have been and M opens the map for fast
travel. Esc or P pauses: settings, the journal of places you've found, restart the chapter, or start a new game.

A controller works over USB or Bluetooth (Xbox, PlayStation, Switch Pro): left stick steers, RT swims, A bursts, X is the
ability, the right stick looks around, START pauses. On a phone, drag anywhere to swim and use the round buttons.

At the top left, DOWN is how deep you are and FLOOR is the bottom under you; the gauge below them shows you between the
surface and the seafloor. Clams give a heart back, and a well-fed animal carries up to five. At a moment worth keeping
(a wreck or landmark close by, inside the fever, a leap together, the surface at dawn) a prompt appears and O opens photo
mode: the bay stops, the screen clears, and Enter saves a picture.

Settings cover volume (with ambience and effects apart), mouse speed, invert Y, turn speed, screen shake, hit flash,
large text and sound captions, which show the sounds that matter (an engine, a shark's pressure wave, fish scattering)
on the side they came from. The game saves as you go and picks up where you left off.

## Running it locally

Serve the folder (`python3 -m http.server`) and open `localhost:8000`; opening `index.html` directly works too. There is no
build step; three.js loads from a CDN. On your own machine `?dev` opens every place and body and `?dev&clock=22` sets the
hour; the published site ignores both, and dev mode never touches your save. Every push to `main` deploys the site
through `.github/workflows/deploy.yml`, which refuses to ship a script that does not parse.

## Code

`index.html` holds the markup and styles and loads three.js as modules; the game is plain scripts in `src/`, run in order
and sharing one scope, one file per system: `00-config`, `01-geo` (the real-world frame, NOAA data and the `Bay` API),
`02-render` (renderer, dot-matrix post, seafloor, sky and water), `03-creatures` (species and bodies), `04-logo`,
`05-structures`, `06-wildlife` (wild animals, the fever, food, mullet shoals), `07-boats` (boats and giggers), `08-input`
(keys, mouse, controller, pause menu, photo mode), `09-audio`, `10-hud`, `11-save`, `12-story`, `13-frame` (the main loop,
the player, the camera), `14-panel` (the dot font and every word on screen), `15-touch` and `16-boot`. A name declared
twice across files stops the game at load, which is on purpose.

`node tools/smoke.mjs` starts the game in a fresh headless Chrome against a server on port 18437 and fails on any
exception. `tools/marks.py` redraws the logo, org avatar and share card in `brand/`.
