# Verification record

Checked on 2026-11-01. This file records evidence; PLAN.md is the authoritative task checklist.

## Current Feral verification

The current rules are real-time steering, hidden-Dot instant victory, highest remaining usage at one minute (exact ties share the win), shared two-pet merging, and a host-controlled whole-game pause. The older round, reciprocal-breeding, multi-floor and all-survivors records below are retained as historical evidence; they do not describe the current game.

- **44 automated tests pass**, and the TypeScript production build passes. Current coverage includes real-time ownership and input validation, capacity, movement gates, hidden state, instant Dot discovery, timeout winners/ties, mating-room reservations and merging, care routes, and whole-game stop/resume behavior.
- A live **`gpt-4.1-mini` custom-card request** returned `mode: ai` with a balanced **20-point** card. The credential is stored locally in an ignored environment file. Additional real hiding and legacy prompted-move requests returned AI mode; the hiding location was legal and the move valid.
- Latest local WebSocket load check: **300 players plus one host**, 12 seconds of movement inputs, **at least 119 motion frames per player**, **zero unexpected disconnects**, event-loop p95 **18.84 ms**, maximum **46.07 ms**, CPU **3,377 ms**, process RSS **237 MB**, approximately **14 MB** received. Server and simulated clients ran locally. This does not establish venue Wi-Fi performance, physical phone performance or public hosting capacity.
- Max's original Codex sprite roster is now the default in practice and live joining. Built-in joins send a companion identifier, not a duplicate sprite upload, and use preset balanced cards.
- Compatible parts of Owen's PR #3 were integrated into the existing world: separate action/join rate limits and touch-release handling, with crowded-world hiding fallback handling. Its separate sandbox and Cloudflare worker were not substituted for this hunt or castle.
- The visible timer now offers Start, Stop and Resume. Server code pauses movement, usage drain, breeding and the deadline together. Browser verified frozen countdown, disabled phone controls, reconnect while stopped and resumed countdown.

- Browser verification: 300 pets rendered on the host with two real browser controllers and 298 simulated connections. Manual steering followed by care navigation reached the mating room; two parents merged into a shared child visible on both phones. The shared child reached the vet and won at the 0:00 deadline.
- Detailed cutaway after merging: 299 actors, 584 draw calls, approximately 5.6 ms CPU frame work locally. This measures JavaScript/render submission, not GPU frame time or physical-device FPS. Phones render only a small map/controller.
- Practice control spacing inspected at desktop and 390px; phone controller inspected at 390px with no horizontal document overflow. Pixel portraits and individual room props remained visible in the cutaway.

### Current external checks

- Live card, hiding-choice and legacy move requests are verified; historical missing-key notes below are superseded.
- Physical-phone venue networking and device rendering performance remain to be checked. Scan the QR code on the shared network and verify joining, steering and reconnecting; inspect the host address and Wi-Fi client isolation if blocked.
- Microphone hardware testing was explicitly left to the user. It is not required by the current real-time hunt.
- No hosted deployment, durable account system or public internet load test has been performed.
- GitHub workflow installation still needs a login with the required permission; no remote CI success is claimed.

## Historical automated verification

15 tests cover the live game: balanced cards, room gates, ownership, capacity, separate room identities, hidden-state filtering, stale and duplicate actions, single round resolution, capture, escape, reciprocal breeding, baby readiness, trap consumption, reset, vet limits, audience ties/expiry, and rollback after failed asynchronous work.

A real HTTP/Socket.IO integration test creates a room, joins a player, rejects player attempts at host controls, checks multiple connections and reconnect, submits a move and resolves a capture. The model adapter tests use the installed OpenAI SDK with a fake transport to exercise strict-schema requests, image input, successful parsing, illegal JSON content, incomplete output, HTTP failures and network errors. These are not live OpenAI calls.

TypeScript and production builds pass. The Three.js scene is lazy-loaded; Vite reports its expected >500 KB scene chunk warning. The obsolete 2D prototype tests and Lucide dependency were removed with that implementation.

## Historical browser observations

- Rendered the original page early, then the real 3D scene and live screens.
- Separate host and two seeker tabs joined the same room, using a description and a PNG upload. An invalid image produced an error; a valid PNG previewed and joined successfully.
- Verified 20-point cards, ability gates, reciprocal breeding, 20 usage spent per parent, baby readiness and selection next round, and no second action for the same owner.
- A word-containing emoji prompt was disabled. An emoji search and rhyming searches resolved to visible rooms. Vet restored 80 usage to 100.
- A labelled manual audience result produced one regional clue. Next round cleared that advantage.
- Refreshing the seeker restored the same identity and current room. The four-round escape ending and missing-submission confirmation worked.
- 3D canvas rendered without runtime errors. Camera orbit, zoom/reset, direct marker picking, room buttons, and switching to simple view and back were checked. Reduced-motion behavior is implemented in both CSS and the animation loop.
- Narrow and wide layouts had equal document client/scroll widths, including observed widths of 312, 609 and 1425 CSS pixels. These are browser checks, not physical-phone performance measurements.
- Visual feedback replaced the pastel floating island and generic slogan/card layout with the Ardross-inspired castle and a compact dark interface. Its current render was inspected against the official exterior photographs.
- The final layout fills the viewport with the castle and uses only left/right glass overlays. On a narrow screen the player has an icon rail and an action panel; room selection opens in that panel. Both views were rendered and exercised.
- Moving Nimbus into the tower automatically lifted the upper castle and exposed the furnished rooms with Nimbus inside. A capture displayed Todd there too. Reset closed the roof; a separate move to the vet also closed it when the last pet left. The manual cutaway preview worked.
- The final overlay was checked through room creation, joining, submitting, manual cheering, resolution, next round, reconnect and reset. The earlier four-round escape playthrough is backed by the final engine tests.
- Built assets were served by `npm start` on port 4175. The production page rendered, created a connected host room, and advertised port 4175 in its join link. Development QR links advertised port 4173 after correcting proxy Host handling. No browser errors were reported for the production render.

GitHub rejected adding a workflow because the current OAuth login lacks `workflow` scope. The prepared configuration remains in `docs/github-actions-check.yml`; no remote CI success is claimed.

## Historical external checks

These record the state at the earlier turn-based milestone. The current status above supersedes the missing-key and live-game instructions in this section.

- No working `OPENAI_API_KEY` was available. Actual paid model-backed cards, moves and hider choices remain unverified. Add the key to `.env.local`, restart, join a room, and confirm AI-labelled card/move events rather than fallback events.
- Microphone hardware testing was explicitly left to the user. The manual path and server comparison rules were checked. On the host's localhost page, start a hunt, choose Measure cheering, allow the microphone, cheer in each three-second window and confirm the displayed result.
- No physical phone was available to verify the venue network. Scan the QR code from a phone on the same network; verify joining, submitting and reconnecting. If blocked, check the host address and Wi-Fi client isolation.
- No hosted deployment, durable database, account system, or public internet load test was requested or performed.

## Historical expanded estate verification

- Final rules suite: 15 tests, including specialist habitat gates, tipsy ordering, cures, clean newborn status, reset cleanup and room lore emitted once. TypeScript and production build pass.
- Browser exercised reciprocal breeding (80 usage per parent, baby ready next round), clinic healing and a rhyming move to the first-floor observatory. The roof opened and the floor selector followed the pets automatically.
- Visually inspected the connected estate, logo maze, graveyard, ivory tower, pixel portrait crops, distinct pets, first/second-floor rooms and darker cellars. Room search and direct map selection worked. Floor cycling wrapped Second → Cellars and Cellars → Second.
- Exterior render draw calls fell from 737 to 225 after static-geometry batching (about 69 percent). This is a renderer work measurement, not a claim of a measured FPS increase on physical phones. Pixel ratio is capped; animation timing uses elapsed seconds; idle duvet geometry no longer recomputes each frame.
- Viewport checks include 390 × 844 and desktop dimensions. The microphone, actual model requests, physical venue phone and remote CI remain the previously recorded external checks.

- Fresh production render after the final asset-loading fixes reported no console warnings or errors. Portrait textures start with a valid placeholder and the SVG uses an explicit hedge color.

### Tibo portrait — 1 November 2026

- Added the locally served public GitHub avatar of Thibault Sottiaux to the tavern,
  with a brass frame and fictional “Keeper of the Reset” plaque; source in README.
- Swapped the adjacent portraits as requested: blue pet left, Tibo right, clear
  of the sideboard. Visually verified in the local browser cutaway.
- TypeScript and production build pass. No game rules changed.

### Pixel portrait and visible reset — 1 November 2026

- Replaced the displayed photograph with generated pixel art matching the pet atlas;
  kept Tibo in the right-hand tavern frame. Source and generation prompt in README.
- Rendered a red reset button and brass RESET plate directly beneath the portrait.
  Visually inspected both in the browser cutaway.
- The server now places the single-charge reset in the tavern each hunt and excludes
  the tavern from bottle placement. The first successful tavern search restores 100
  usage and clears tipsiness; subsequent visitors receive no further charge.
- All 16 tests pass, including two simultaneous tavern visitors and recharge after
  restart. TypeScript and production build pass.

### Single-floor courtyard castle and Max PR integration — 1 November 2026

This supersedes the earlier multi-floor layout and its floor controls.

- Integrated Max's PR #2 practice controls, atlas importer and elapsed-time movement, preserving the newer 3D pet bodies, portraits, care animations and Tibo reset.
- One connected castle contains 26 furnished ground-floor rooms and a broad central courtyard. Four roof ranges, taller consistent façades, a dominant keep and corner towers replace the detached sheds and enormous blank roof. Gardens were enlarged 1.8 times in width/depth, with matching coordinates and routes.
- All 42 hiding places and three service locations have connected routes. New tests check front-room doors, court fountain clearance, flight above the tallest keep, continuity on retargeting, frame-rate-independent samples and exact arrivals for every destination pair.
- Final `npm test`: 25 passed. TypeScript and production build passed. The lazy Three.js scene bundle still triggers Vite's size advisory (about 647 kB before gzip); physical-device FPS has not been measured.
- Browser: closed exterior, open furnished cutaway, ten visible simultaneous journeys, follow camera, pause preserving positions, sprite input disabled during travel, and a live host/seeker far-wing search. The host showed Pets travelling and disabled advancement. The seeker reached Banquet of Tokens with 90 usage.
- The 390px seeker viewport had a 390px document width. No microphone hardware or actual model request was tested in this integration. Earlier external checks remain open.
- Screenshots saved locally as castle-courtyard.png and castle-running.png in the task visualization folder; these are evidence, not repository assets.

- The live host enabled Next round after arrival and advanced to round 2. Fixed the custom hip-roof UV attribute mismatch; a fresh browser reload reported no new renderer errors. Merge commit `497cc03` was pushed and matched the remote main ref.

### Room floor flicker — 1 November 2026

- Front gallery slabs and room floors both ended at height 0.98, causing depth conflicts while orbiting. Gallery surfaces now end at 0.94, below the room finishes. Side passages end at 0.92 and cross-galleries at 0.94; each passage is created once instead of three times.
- Inspected the open cutaway at close zoom and after orbiting: room finishes stay visible without the competing gallery surface. TypeScript and production build pass. No gameplay or route coordinates changed.

### Feral: survival clock, shared breeding and selective companion integration

- Server/shared-rule tests: 33 passing. They cover a 60-second authoritative deadline, reconnect, expiry without host input, late model responses, no-survivor result, shared survivors and fresh restarts.
- Breeding now reserves exactly two places, accounts for travel before starting an eight-second duvet effect, consumes two parents and creates one balanced shared pet. Tests cover third-pet rejection, arrival timing, low usage, overlapping ownership, expiry, one action shared by both owners and restoration of originals on restart.
- Browser practice: two pets walk to the room, duvet billows with rising pink hearts, parents disappear and a new named pet emerges. A third pet cannot enter. Repeated merges and selection fallback were exercised.
- Selectively ported Max's `9fb5bc8` companion assets, picker and original sprite cadence. Preserved the newer castle, 3D animal bodies, single-floor movement graph and overlays. Browser selected/rendered Dewey in practice and joined a real local room with Dewey's atlas; its live mating-room action resolved.
- Tibo's enlarged illuminated frame and reset pedestal were inspected while orbiting and while pets moved. Fixed coplanar photograph/frame surfaces, including a wider separation for annex portraits.
- Phone seeker at 390px: document width 390px, clock and essential controls visible. TypeScript and production build pass; Three.js lazy bundle size advisory remains. Real API, microphone, physical phone and CI permission checks remain external.

- Live browser reached 0:00 and awarded Dewey; practice reached 0:00 and listed ten surviving pets. Play again restored 1:00 and original usage in practice, and preserved the live player in a fresh lobby.

## Durable Objects and phone repair — 1 November 2026

- All 45 rules/transport/route tests pass, including free lobby movement without spending usage or discovering the Dot. Worker typecheck and production build pass.
- Local Durable Object runtime: 301 native WebSockets, minimum 47 motion frames per player during the movement check, zero unexpected disconnects; lobby movement, host pause/resume and authenticated reconnect passed. This is separate from the earlier Node Socket.IO benchmark.
- Phone browser at 390×844: visible Join game action submitted successfully; aligned system font and usage bar; active arrows before countdown; map position changed with held keyboard input. No waiting-for-host message remains. Physical Safari screenshots prompted this repair; physical-device retesting remains external.
- Cloudflare backend deployed and runtime OpenAI secret configured. Sites frontend publication and public end-to-end verification are tracked in PLAN.md until observed.

- Public Cloudflare test against `feral-game.maxmelander03.workers.dev`: 301 connections, 21.0 seconds to join/connect, minimum 47 movement frames, zero unexpected disconnects; movement, pause/resume and reconnect passed. Runtime config reports AI configured. Server now completes close handshakes so departed clients release connection slots. This remains simulated-client evidence, not 300 physical phones.
