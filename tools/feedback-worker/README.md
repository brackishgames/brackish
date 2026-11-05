# Feedback Worker

The game's **F** key (or *Send feedback* in the pause menu) takes a note from the player and files it as a GitHub issue, with what the game knew at that moment: version, chapter, body, place, depth, device, the last lines on screen, any errors. Until this Worker is deployed, the game opens a filled-in *new issue* page instead, which needs the player to have a GitHub account. With it deployed, a note goes straight from the game.

It accepts posts only from the game's pages, caps each body at 32 KB, allows five reports a minute per address, checks every field, and builds the issue with the same code the game uses (`src/lib/feedback.js`), which defuses `@` mentions so a note can never ping anyone. Its tests are in `tests/unit/feedback-worker.test.mjs`.

## Deploy it

1. **A token for it.** Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with access to `brackishgames/brackish` only, and the single permission *Issues: Read and write*. Nothing else.
2. **The labels it uses**, once:
   ```sh
   gh label create feedback --repo brackishgames/brackish --color 0e8a16 --description "From the game's F key"
   gh label create crash    --repo brackishgames/brackish --color b60205 --description "An error report from the game"
   gh label create beta     --repo brackishgames/brackish --color 5319e7 --description "Reported against a beta build"
   ```
3. **Deploy**, from this folder:
   ```sh
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN      # paste the token
   npx wrangler deploy
   ```
   Wrangler prints the Worker's address, like `https://brackish-feedback.<you>.workers.dev`.
4. **Point the game at it.** In `src/00-config.js` set
   `const FEEDBACK_URL = 'https://brackish-feedback.<you>.workers.dev/feedback';`
   The page's security policy already allows `*.workers.dev`. If you use your own domain instead, add it to `connect-src` in `index.html`.

Optional: to gather crash reports as comments on one issue instead of a new issue each, open an issue like *Crash reports* and put its number in `CRASH_ISSUE` in `wrangler.jsonc`. Crash reports only ever come from players who turned on *Send crash reports* in settings, and at most three per visit.

Logs: `npx wrangler tail`, or the Worker's Observability tab in the Cloudflare dashboard.
