# The models

Every model in the game, built by the code that builds it for the bay. Open any name to turn it in GitHub's 3D viewer. Written by `npm run specimens`; don't edit by hand.

<img src="../screenshots/specimens.png" alt="Every model in the game, in plain studio light" width="100%">

And as the player sees them:

<img src="../screenshots/specimens-in-game.png" alt="Every model on the game's own dot-matrix display" width="100%">

| Model | Kind | Size (x × y × z) | Real size (m) | Triangles |
|---|---|---|---|---|
| [Cownose Ray](cownose.stl) | animals | 0.90 × 0.16 × 1.42 m | 0.9 | 16,812 |
| [Bottlenose Dolphin](dolphin.stl) | animals | 1.16 × 0.71 × 2.60 m | 2.6 | 12,800 |
| [West Indian Manatee](manatee.stl) | animals | 1.26 × 0.80 × 3.00 m | 3 | 13,328 |
| [Bull Shark](bull.stl) | animals | 1.17 × 0.78 × 2.40 m | 2.4 | 13,088 |
| [Great Hammerhead](hammer.stl) | animals | 1.44 × 1.09 × 3.40 m | 3.4 | 13,968 |
| [Striped Mullet](mullet.stl) | animals | 0.13 × 0.10 × 0.45 m | 0.45 | 13,208 |
| [Cownose Ray, in the fever](fever-ray.stl) | animals | 0.85 × 0.13 × 1.37 m | 0.9 | 304 |
| [Schooling mullet](school-fish.stl) | animals | 0.04 × 0.08 × 0.34 m |  | 76 |
| [Jellyfish](jelly.stl) | animals | 0.46 × 0.49 × 0.46 m |  | 1,584 |
| [Seabird](bird.stl) | animals | 2.00 × 0.46 × 1.18 m |  | 572 |
| [cargo ship](ship.stl) | boats | 28.56 × 48.97 × 183.37 m | 180 | 2,851 |
| [cruiser](cruiser.stl) | boats | 4.00 × 5.07 × 12.18 m | 12 | 2,377 |
| [skiff](skiff.stl) | boats | 2.20 × 1.88 × 6.07 m | 6 | 2,465 |
| [Channel buoy, chain and sinker](buoy.stl) | structures | 2.46 × 12.17 × 2.46 m |  | 1,360 |
| [Clam](clam.stl) | plants and the bottom | 0.36 × 0.17 × 0.30 m |  | 1,664 |
| [Seagrass tuft](seagrass.stl) | plants and the bottom | 0.25 × 0.65 × 0.29 m |  | 18 |
| [Sea fan](sea-fan.stl) | plants and the bottom | 1.06 × 0.82 × 0.00 m |  | 254 |
| [Rock](rock.stl) | plants and the bottom | 1.71 × 1.34 × 1.72 m |  | 180 |

The last rows of the picture are real places, as built in the bay. To see any of them on the game's own display, from four angles at once: `node tools/serve.mjs`, then `localhost:8000/?dev&specimens`.
