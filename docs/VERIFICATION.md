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

## Latest traitor and start-gate correction

- The prior free-lobby movement behavior is superseded: movement now remains locked until host Start. Both screens use the same authoritative deadline; Stop freezes the entire game.
- 48 tests pass, with new checks for the Start gate, one traitor per nine players, role privacy, collision ban, graveyard relocation, blocked care, safe spawning, pause safety and restart restoration. Production build and Worker typecheck pass.
- Traitor identities are kept server-side. Only a player's private state reports their own role. Nearby collision candidates use a spatial grid; moving traitors have a two-second ban cooldown and cannot attack inside base camp or during the duvet animation.
- Ban state travels with motion frames; the renderer teleports the pet to the graveyard instead of drawing a journey through walls. Phone controls block selection and iOS copy callouts.

## Published Feral verification | 1 November 2026

- Sites publication succeeded: https://feral-hackathon.sugarybrine.chatgpt.site. Version 1 uses source commit `2e59b42a777758514a6a2588f7e0a14f2f4560bc`; deployment `appgdep_6ae76f35659c8191a375874f7c9cb933` reached succeeded. Current frontend and backend source files match the packaged Sites checkout.
- Latest Cloudflare Worker version: `aea55284-5efe-45b6-9df2-4e4ff82b867d`. Public runtime configuration confirms server-side AI configuration.
- Repeated the public native-WebSocket test after deploying the traitor changes: 301 connections, 23,083 ms join time, minimum 75 motion frames per player, zero unexpected disconnects. Movement, Stop/Resume and reconnect passed.
- Published-browser host creation and player joining passed. Phone arrows were disabled before Start; both screens showed 0:52 from the shared deadline. Stop froze both at 0:47 and disabled player actions; Resume continued the game. The finished phone showed 0:00 and its winner.
- Rendered phone at 390 by 844: document and scroll widths both 390, with aligned controller and no horizontal overflow. Computed arrow user-select is none; Safari callout suppression is declared in CSS, but physical Safari was not tested here.
- A separate nine-player public-backend check verified exactly one private traitor, shared deadlines, a real collision, zero usage and relocation to the graveyard. The death-message rendering is implemented; its exact eliminated-phone screen was not separately captured in this publication check.
- All 48 automated tests and Worker TypeScript checks passed. The production build passed in the development chat. Browser logs had texture-load warnings but no observed render failure; the castle and phone companion rendered.
- Remaining external checks: real venue phones/network and user-owned microphone hardware. GitHub workflow installation still requires workflow permission. These do not block the verified publication.

## Sites-only migration — local checks, 1 November 2026

Owen PR #3 at `756652f` supplied the Sites-managed Worker/D1 hosting pattern. This implementation keeps Feral's existing Rooms engine and castle, rather than adopting the PR's independent shared-world sandbox. The selected Feral Site ID is unchanged. Publication verification follows separately; the earlier release remains the live reference until deployment succeeds.

- 52 automated tests passed, including SQLite-backed Sites API tests for 300 admissions and parallel joins, private roles, host authority, ordered input, pause/resume, merge/shared ownership, care routing, original-pet restart, timeout, Dot capture and persisted graveyard bans.
- Sites and retained Durable Object TypeScript checks passed. Sites Worker build embeds all ten complete sprite atlases and castle assets in approximately 4.24 MB, retaining original images in source.
- Local HTTP stress run: 300 players plus host, 7,602 ms to join in batches of 20, at least 20 state responses per client during 12 seconds, median 400 ms and p95 782 ms response time, zero failed requests. Pause/resume verified afterward. This measures a local Worker/D1 emulator, not 300 venue phones or hosted capacity.
- Initial crowd run failed 196 requests: every phone competed to update the world, overloading the emulator. The fix combines input/authorization/view access into one indexed statement and leaves normal ticks to the host. A phone can advance the simulation when the host's state becomes stale. The repeat above passed.
- Browser: phone joined, controls locked before Start, matching 0:39 host/phone clocks, movement input, Stop at 0:35, refresh preserving the stopped deadline, Resume, and path-following vet arrival with usage restoration. 390px phone layout inspected. Full final-publication and further repeated-game checks remain pending.
- A pre-existing rollback test compared wall-clock `serverNow` across two calls and intermittently failed by 1 ms. It now excludes only that clock field while comparing the complete retained game state.


### Public Sites-only verification (version 2)

Published to the existing Feral URL on 1 November 2026. Health reports `transport: sites`; configuration reports server-side AI enabled. Sites version 2, source `eb4472c9d7cc57a0b1a2b15b9274ebce5faa3254`, deployment `appgdep_6ae775581eb48191864437d6881d1e23` succeeded. The standalone Cloudflare backend is no longer used by this frontend.

Public HTTP stress check: 300 players plus host, 43,841 ms admission in batches of 20; at least five responses/client during 12 seconds; zero failed requests; Stop/Resume passed. Median latency was 1,670 ms and p95 2,814 ms. This exposed crowd latency despite successful requests, so the next update reduces ordinary phone polling and avoids competing simulation ticks while the host is active. These measurements must not be presented as smooth 300-phone gameplay.

A separate public nine-player game assigned one private traitor, completed a collision ban, moved the browser-controlled Dewey to the graveyard with zero usage, and ended normally. At 390px, the phone visibly showed “Banned for distillation”, “Your pet is dead”, Pet Memorials, and disabled movement/care controls. Two complete local browser games additionally covered steering, timer pause/resume/reconnect, vet recovery, original-pet restart and the Dewey–Fireball shared-pet merge through the final winner screen.

The next release also sends direction changes/releases without waiting for a state poll, retains sequence protection, and settles expiry from a phone even if the host stops polling. A new regression covers that deadline case; the complete suite now has 53 passing tests. The live host menu is replaced by a square, responsive QR code, and HTML is served with revalidation so subsequent updates are visible on reload. Packaging removes duplicate static output; the deployment archive is approximately 2.3 MB instead of 38 MB.

### QR release and further playthrough fixes

Sites version 3 deployed successfully (`appgdep_6ae776e2bb108191ab8011f49fdba0eb`, source `183ccbaf94fcb5da2c102b677d3b30da491093f1`). The existing host room survived deployment and the public menu was replaced by the QR code. Repeat 300-phone test: admission 47,466 ms, minimum seven responses/client in 12 seconds, median 676 ms, p95 2,098 ms, zero failed requests; pause/resume passed. Median latency improved materially, but the tail remains a real full-crowd limitation.

A further 42-seeker public search exposed a request-boundary race. Simulation could capture the Dot, then reject a destination because the game was over, discarding the simulated win along with the rejected command. A new SQLite regression reproduced the persisted phase incorrectly remaining `seeking`. The fix commits simulation progress and the result before returning the command rejection. All 54 tests pass after that repair. This is separate from the full-crowd transport measurements above.

The follow-up also removes the transient host Menu/Offline-rules flash while connecting, gives held Sites input a bounded 1.5-second refresh allowance, and retains immediate release delivery. Full-search tooling uses real legal routes and treats only verified eliminations/game endings as expected move rejections.

### Final public replay after the race repair

Sites version 4 succeeded: source `17ebecb444503f51752213a3f1366265b32eccdd`, deployment `appgdep_6ae7783bc7ec8191a1b7a836ae8de1af`. In a fresh isolated public room, 42 scripted seekers selected pets with legal abilities and searched every hiding place. The hunt returned `outcome: found` after 8,581 ms, revealing the cistern and naming its seeker as winner. The browser host showed the same persisted winner. This confirms the repaired result survives concurrent late destination requests. No gameplay tests used the user's existing room.

Together with the two complete local browser games and public nine-player traitor game above, coverage includes joining, start gating, matching clocks, Stop/Resume, reconnect, steering, vet recovery, shared breeding, original-pet restart, graveyard/death UI, timeout and Dot capture. All 54 automated tests pass. Real Safari hardware, venue Wi-Fi and microphone hardware remain external checks. The 300-client HTTP results above demonstrate admission and response reliability, with a remaining p95 latency limitation; they are not evidence of smooth gameplay on 300 physical phones.
