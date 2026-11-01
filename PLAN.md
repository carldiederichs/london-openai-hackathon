# Feral task checklist

Authoritative checklist. Latest instructions: full-screen Ardross-inspired 3D castle;
transparent glass UI at the left and right, with a top-centre one-minute clock; remove titles/branding/dashboard
clutter and delete the 2D prototype. Push verified milestones directly to main.
Publish every completed change to the same public Feral Site and verify its deployment; a Git push alone does not complete the task.
Do not interact with Notion. Microphone hardware testing is reserved for the user.

## Verified milestones

- [x] Create and verify the public GitHub repository.
- [x] Build, test and push the original prototype; PR #1 was made ready first.
      The user has since requested its removal; this is historical context only.
- [x] Implement the authoritative room server, host/player sessions, QR/code joining,
      ten player slots, reconnect and simultaneous submissions. HTTP/Socket.IO tests
      and separate host/seeker browser sessions verified these flows.
- [x] Add image upload and description fallback. Browser tested PNG preview/join,
      bad-image rejection, model-independent sprites and balanced 20-point cards.
- [x] Add constrained prompts, structured model adapters and deterministic legality.
      SDK transport tests cover successful responses, malformed/incomplete responses,
      network/HTTP errors and fallback. Actual OpenAI calls are separately blocked.
- [x] Add Todd as a dot-shaped AI shadow. It derives a distinct ability allocation
      from a seeker within 20 points and hides only where its own card and at least
      one ready seeker permit. Active hidden state is filtered from clients.
- [x] Implement one action per player, usage, bottle traps, Tivo reset, vet and
      reciprocal breeding. Browser verified parents' costs, next-round baby search,
      ownership, emoji rejection, rhyming moves, healing and four-round escape.
- [x] Implement one cheering result per round, comparison/ties, round identity,
      cancellation, expiring effects and labelled manual fallback. Browser verified
      a manual result; hardware testing remains with the user.
- [x] Render real 3D locally. Camera orbit, zoom/reset, direct marker selection,
      simple-view fallback and responsive layouts were inspected in the browser.
- [x] Replace the floating island with original geometry inspired by Ardross Castle:
      long sandstone frontage, tall square tower, slate roofs, corner turrets,
      bay windows, curved terrace stairs, lawns and cypress woodland. Visually
      inspected against the castle's official exterior photos.
- [x] Push verified intermediate milestones. The castle and cutaway milestone
      `0c8d498` was pushed and verified against the remote main ref.

## Current implementation

- [x] Automatically lift the roof and upper castle when a pet enters
      an interior location. Show furnished rooms and the pet inside; lower the exterior
      when all pets leave. Browser verified tower entry, a visible pet inside,
      capture, reset, and roof closure after the last pet visited the vet.
      Reduced-motion handling was reviewed in the animation code.

- [x] Make the castle fill the viewport; use only left/right glass
      overlays. Remove all promotional headings, branding, footer, dashboard cards
      and permanent secondary information. Show players, log and rules on demand.
      Acceptance: screenshot shows an unobstructed full-screen world with controls
      at its sides. Narrow-screen player actions and the room selector were rendered
      and exercised successfully in the final overlay layout.
- [x] Delete the 2D prototype, route, UI, old engine and old tests.
      Retain only shared pet art/data used by the 3D game. Acceptance: no 2D navigation
      or prototype implementation remains; tests and build use only live mode.
- [x] Recheck host creation, QR joining, player action, cheering fallback, round
      resolution, reconnect, capture/escape and reset with the final overlay UI.
      Final overlay verified creation, joining, manual cheering, submission,
      resolution, next round, reconnect, capture and reset. Escape was browser-tested
      before the visual revision and remains covered by the final engine tests.
- [x] Run final tests, TypeScript, production build and source review. All 13 tests
      pass. Built server on port 4175 served the game, created a connected room and
      advertised the correct QR port. Development QR uses port 4173.
- [ ] **Blocked**: GitHub CI setup needs workflow permission, which the current
      GitHub login does not have. The attempted push was rejected; the workflow
      is retained as `docs/github-actions-check.yml` for later installation.
      Local tests and build passed independently.
- [x] Update README, design notes and verification record for the final interface
      and deleted prototype. Keep setup, fallback and persistence limits accurate.
- [x] Push all verified changes directly to main, check remote commit identity and
      leave the local rendered page open. No hosting deployment requested.
- [x] Save a concise repository handoff and reconcile this checklist. README and
      docs/VERIFICATION.md contain setup, evidence and remaining device/key checks.
      No Notion reads or writes while the user's pause remains active.

## External checks still open

- [x] Real OpenAI custom-card, hiding-choice and legacy prompted-move requests returned AI mode; card balanced to 20 points and hiding choice legal. Key is in ignored `.env.local`, never source or browser variables.
- [ ] **User-owned**: Microphone hardware check. The user explicitly chose to do it.
- [ ] **Not observed**: Joining from a physical phone on the venue network. Browser
      sessions and responsive layouts are tested; Wi-Fi isolation and physical
      device performance still require the actual phone/network.

## Superseded / outside scope

- The separate live PR plan was superseded by direct-to-main pushes.
- Preserving the 2D prototype was superseded by deleting it.
- Header/hero/card-dashboard layouts were superseded by edge-only glass overlays.
- Identity voting, a human hider and a
  persistent account/database system were not selected.

## Visible mechanics and pet habitats

- [x] Animate movement, nursery duvet/hearts, and a visible vet treatment.
- [x] Bottle discoveries produce a tipsy state; vet and Tibo reset cure it. Show discovered props without leaking hidden locations.
- [x] Add water, air, narrow, tall and dark hiding places with enforced requirements.
- [x] Render and exercise the changes, test rules, update documentation and push main.

## Mansion detail and entertainment

- [x] Generate original antique pet photographs and add an inspectable ancestral gallery in the library.
- [x] Add room-specific AI lore and discoveries, richer interior props, and quieter world labels.
- [x] Verify portraits, final visuals, rules and build; push directly to main.

- [x] Expand formal gardens with flowers, fountain, greenhouse and paths.
- [x] Open Petdex; add a linked in-game pet collection with abilities and habitats.
- [x] Replace realistic portraits with pixel AI pets, enlarge the scene/pets, and hang portraits throughout the mansion.

## Latest feedback — remaining acceptance checks

- [x] Make the gardens substantially larger: lake, boathouse, maze, orchard, glasshouse, pavilion, walls, benches and connecting promenade. Expanded further to 30 destinations with upper floors, cellars and memorials.
- [x] Replace large gold destination badges with subtle rings; hover shows name, requirements and description; phone tapping and room buttons remain available.
- [x] Use sixteen distinct fictional pixel-pet ancestors instead of repeating four realistic photographs. Verify the texture crops and gallery captions.
- [x] Make active pet silhouettes distinct (robot, ghost, dragon, frog, dog, owl, bunny and cat), with size differences from the cards.
- [x] Final regression tests, browser checks at desktop/phone sizes, asset checks, current docs, clean main push and local checkpoint.

- [x] Add first and second floors with three new hiding places each, plus three dark cellar rooms and a floor selector. Verify automatic cutaways and floor visibility.
- [x] Add a connected pet graveyard with memorials and relocate the Dark-mode Crypt there; add the Ivory Tower as a flying destination.
- [x] Make the maze the actual OpenAI knot and retain clear connected access paths.
- [x] Make the final destination rings visibly clickable, with hover details and floor-aware targets.

- [x] Verify previous/next floor cycling wraps in both directions and direct floor selection works.

- [x] Smooth animation timing across frame rates, avoid idle cloth work, batch static geometry and measure draw-call improvement.
- [x] Repair floor control spacing with equal arrow sizes, consistent gaps and one compact glass bar.

## Earlier milestone evidence (multi-floor layout now superseded)

- At that milestone, the implementation above was complete. `npm test`: 15 passing tests; TypeScript and production build pass.
- Browser verified breeding, vet healing, upstairs movement and automatic floor selection after rendering optimizations. Floor cycling wraps both directions; room search, direct lake selection and pixel-pet gallery were exercised.
- The final 390px browser viewport had equal client and scroll widths. Physical-device FPS and venue networking remain external checks.
- Exterior draw calls fell from 737 to 225. Static geometry is batched, obsolete label textures are removed, animation uses elapsed time, and idle duvet work is skipped.
- Built server health and bundled portrait/logo assets returned HTTP 200.
- Only the four explicitly listed external checks remain: real API key, physical phone, user-owned microphone test and GitHub workflow permission.

- [x] Add Tibo's actual photograph in a brass frame in the ground-floor tavern,
      with a “Keeper of the Reset” plaque and room lore. Record the photo source.
- [x] Restyle Tibo to match the pixel-pet portraits, retaining the right-hand frame.
- [x] Add a visible red reset beneath the portrait. Searching the tavern activates
      one shared charge per hunt, restores 100 usage and cures tipsiness. Keep traps
      out of that room; verify the charge cannot be claimed twice and replenishes
      on a new hunt. All 16 tests and production build pass.

## Current integration: Max's PR and one coherent castle

- [x] Integrate PR #2's practice hunt, Codex sprite importer and elapsed-time journeys while preserving 3D animal bodies, portraits, Tibo reset and care mechanics.
- [x] Replace multiple playable floors with 26 furnished rooms on one massive ground floor. Keep all 42 hiding places; remove floor controls.
- [x] Rebuild the exterior as four joined castle ranges around a broad central courtyard, with consistent façades, roof pitches, windows and towers. Closed exterior and cutaway inspected in the browser.
- [x] Scale gardens across the castle frontage. Share their transform with markers and routes; connect all rooms and service destinations through doors and paths.
- [x] Add smooth strides, articulated legs, swimming, wingbeats, rounded corners, smooth heading changes and Follow pet. Preserve live position when redirected.
- [x] Verify pause, ten visible practice journeys, a live host/seeker far-wing move, travel-locked round advancement and a 390px seeker layout without horizontal overflow.
- [x] Run server and movement regressions: 25 passing tests and successful TypeScript/production build. All destination pairs, court clearance and rear doors covered.
- [x] Update setup, movement boundaries and verification notes. Actual model calls, physical-phone networking, microphone hardware and CI remain the external checks above.
- [x] Merge commit `497cc03` pushed directly to main; remote commit identity verified.
- [x] Saved a sanitized local continuity checkpoint with readback and retained the practice preview. Notion remains paused.

Multiple playable floors, cellars as a separate floor and floor cycling are superseded by the latest single-floor request. Previous floor-specific checks above are historical evidence only.

## Room flicker repair

- [x] Removed duplicate passage slabs and separated overlapping gallery/room floor heights. Inspected the cutaway at close zoom and multiple camera angles; TypeScript and production build pass.

## One-minute survival and minimal interface

- [x] Authoritative 60-second deadline, survivors with usage above zero, shared winners, closed actions at expiry, restart and reconnect safety. Replace the four-round ending.
- [x] Add the large top-centre clock to live and practice; freeze at zero and show winners.
- [x] Remove permanent practice instructions, status panels and duplicate details; collapse camera/secondary controls while retaining room access, uploads, care and phone joining.
- [x] Verified deadline races, live/practice 0:00 winners, fresh 1:00 restart with original pets, and 390px player controls. 33 tests and production build pass.

## Current additions and reopened visual check

- [x] Name the game Feral in page metadata, package and docs; preserve existing sessions.
- [x] Reserve exactly two mating places, wait for both arrivals, merge into one shared pet; balanced stats, combined usage minus 40, shared orders, restart originals. Server/shared-rule tests pass.
- [x] Browser verified floating duvet, large ascending hearts, third-pet rejection, and replacement of both parents with the shared pet.
- [x] Selectively integrate Max's latest `9fb5bc8` functionality: original companion assets, live picker, optional practice picker and original sprite cadence. Preserve the current world, 3D guardians and all 42 routes.
- [x] Browser verified Dewey selection/rendering in practice and live joining, balanced card and a live mating-room action.
- [x] Enlarged/lit Tibo and raised the reset onto a visible plinth. Separated photo planes from frame faces; browser orbit and moving pets show complete, stable portraits.
- [x] Final checks, current docs, direct main push and local checkpoint completed in the publication closeout. Notion remains paused.

## Real-time crowd game (latest request)

This supersedes turn-by-turn prompts and the ten-player cap. Preserve the mansion display and existing care mechanics.

- [x] Server-authoritative real-time movement with phone arrow/WASD controls, QR joining, persistent room sessions and up to 300 player connections.
- [x] Swipeable default Codex pet picker plus existing custom image/description option; swiping and joining verified in browser.
- [x] Hide the Dot before the game; never expose its location to active clients. Finding it instantly wins; otherwise determine survival result at the 60-second deadline.
- [x] Preserve two-place mating, shared pet ownership, vet/bottles/reset and connected castle routes in real-time play; care-route, reservation and merge regression tests pass.
- [x] Batch updates and load-test 300 simultaneous player WebSockets plus host. Final 12-second run: minimum 119 motion frames/player, zero unexpected disconnects; p95 event-loop delay 18.84 ms. Local clients, not venue-device proof.
- [x] Browser verified host + two phone controllers, swiping/joining, steering, reconnect, care-route merge/shared ownership, vet, Stop/Resume and the 0:00 highest-usage winner. Instant Dot capture and exact ties verified in rules tests. Publication tracked separately.
- [x] Reconciled Owen PR #3 (`a6cfafb`): ported separate venue join/create limits, touch release/page-hide handling and full-crowd Todd-card fallback. Kept integrated castle paths, hidden Dot, shared breeding and current visuals. Standalone sandbox/Cloudflare backend left out because it lacks these rules and uses incompatible bounds. Draft remains open; compatible work was ported, not blindly merged.
- [x] Verify Owen’s access: existing write invitation pending; Owen successfully opened draft PR #3, so no additional permission change was needed.
- [x] Subagent updated Feral README and companion docs; current live rules and verification docs reviewed.

- [x] Max’s actual Codex pets are the default. Every room has batched specialist props and gardens have lanterns/shared warm lighting. Browser inspected detailed cutaway with 300 pets; settled cutaway after merging had 299 actors, 584 draw calls and ~5.6 ms CPU frame work locally (not physical-device FPS).
- [x] Aligned practice pet grid, sprite slots, two-line names, back/action row and usage row. Desktop and 390px renders inspected; narrow document width equals scroll width.

Current verification: 45 tests and production build pass. Local 301-WebSocket load test repeated after integration; final measurement recorded above. Irregular-tick routing regression covers manual movement followed by care navigation.

## Latest timer and AI configuration requests

- [x] Visible Start / Stop / Resume beside clock in practice and host. Browser verified frozen countdown, disabled phone controls, reconnect while stopped and resumed countdown. Host authority and frozen mating deadlines covered by test. Removed duplicate Start controls and spare tagline.
- [x] Enabled the supplied scoped OpenAI key in ignored mode-0600 `.env.local`; server reports configured. Real card, hider and legacy move requests returned AI mode. Source credential scan clean.

- [x] Subagent prepared `docs/DEMO.md`: setup, exact clicks, timed 90-second shots and both endings. Recheck final phone labels and hosting URL in the item below.

## Reopened phone usability and Sites hosting

- [x] Replace cramped phone overlays with a single-column flow, system font, aligned usage bar and visible Join game button. Browser verified submission and live map movement at 390px. Lobby exploration is active without usage/traps/wins; the host countdown resets pets to camp.
- [x] Implement Cloudflare Durable Objects using the existing game rules, durable snapshots, authenticated native WebSockets and separate venue join/create limits. Local Worker test: 301 connections, minimum 47 movement frames, zero disconnects, lobby steering, pause/resume and reconnect.
- [x] Deploy Worker with server-side OpenAI secret. Public endpoint native-WebSocket test: 301 connections, minimum 47 movement frames, zero disconnects, movement/pause/resume/reconnect verified.
- [x] Publish the Sites frontend and verify phone/host play from its final URL; see the publication checkpoint below.
- [x] Sites publication, returned URL, phone/host state and hosted setup verified. API credentials remain outside frontend assets and Git.
- [x] Reconcile the 90-second demo instructions with the final phone controls and deployed URL.

## Latest gameplay corrections and final publication

The latest instruction supersedes lobby exploration: controls must remain locked until the host starts the synchronized timer.

- [x] Disable arrow text selection and declare iOS callout suppression; hosted 390px layout and computed user-select verified. Physical Safari remains an external check.
- [x] Lock phone movement until Start; hosted matching countdown and Stop/Resume verified.
- [x] Implement private traitors, collision bans, graveyard relocation, disabled actions and the death message. Automated rules and a public nine-player collision check passed; see exact browser coverage in docs/VERIFICATION.md.
- [x] Tests, production build, Worker checks and the updated public 301-connection test passed.
- [x] Publish backend and Sites frontend, verify the public URL and host/player play, and push the code/docs milestone `7c6bb60` to main with matching remote hash.
- [x] Update README, demo and verification record; save the sanitized local checkpoint with readback.

Historical status before this publication closeout: milestone `02e4a49` had been pushed, while traitor changes and Sites publication were still pending. The verified publication checkpoint below supersedes that status.

## Publication checkpoint | 1 November 2026

Live: https://feral-hackathon.sugarybrine.chatgpt.site. Sites version 1 and the latest Durable Object backend are deployed. The detailed evidence is in `docs/VERIFICATION.md` under Published Feral verification. The development chat stopped before final publication; the publishing chat completed it and checked incoming state before handoff. Owen's latest PR branch targets a different Site and separate game implementation, so its hosting identity was not substituted for this selected Feral Site. Compatible contributions already in Feral remain intact.

Code/docs milestone `7c6bb60` is pushed and the remote hash matches. Sanitized local checkpoint `3f4d7647-608f-471a-8cc8-eac8439cdfe4` was saved and read back. Notion remains paused for this project. Physical-device/venue-network and user-owned microphone checks remain external; GitHub CI installation remains blocked by workflow permission.

## Sites-only migration and repeated game checks

Owen's updated draft PR #3 (`756652f`) is available. His Sites Worker + D1 approach removes the separately operated backend, not the need for authoritative shared state. Preserve Feral's current world, pets and complete hunt rules; preserve this Site's identity and public audience.

- [x] Inspect Owen's updated draft and reconcile its hosting pattern with Feral; do not replace the current castle with the separate shared-world sandbox.
- [x] Port Sites-managed persistence and HTTP controls around the existing rules, including exclusive room updates, ordered inputs, private roles and hidden Dot state.
- [x] Preserve all sprite sheets and castle assets in a 4.24 MB Sites Worker build; existing model key configured as a Sites runtime secret (revision 1).
- [ ] Repeat full games and fix observed faults: joining, start/stop/resume, steering, care/merge, Dot capture, traitor death, timeout, restart and reconnect.
- [ ] Verify mobile rendering and crowd transport separately; report hosted capacity evidence accurately.
- [x] Update README and demo with Sites-only operation; publication status and transport-specific verification remain explicit.
- [ ] Push main, publish the selected Feral Site, verify its actual public game, and save a sanitized local checkpoint. Keep the old backend available until the replacement passes.

- [x] Replace the live host Menu and tabs with a single QR code; timer controls remain. Local render inspected; public verification is part of the final publication item.
- [x] Public nine-player traitor rehearsal: browser phone visibly banned, relocated to Pet Memorials, usage zero, movement/care disabled, normal final winner.
- [x] Complete two local browser games including pause/reconnect/resume, vet, shared breeding and winner screens; 53 rules/transport tests pass after an absent-host deadline regression fix.
- [ ] Repeat public games and crowd latency check after the QR/menu and polling update, then publish any further fixes. Keep user room 5F7AEC separate from test rooms.
