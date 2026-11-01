# Promptkeep task checklist

Authoritative checklist. Latest instructions: full-screen Ardross-inspired 3D castle;
transparent glass UI at the left and right only; remove titles/branding/dashboard
clutter and delete the 2D prototype. Push verified milestones directly to main.
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

- [ ] **Blocked**: Real model-backed card, move and hider verification requires a
      working server-side OPENAI_API_KEY in .env.local. No key was available.
      Never put the key in source, browser variables or chat.
- [ ] **User-owned**: Microphone hardware check. The user explicitly chose to do it.
- [ ] **Not observed**: Joining from a physical phone on the venue network. Browser
      sessions and responsive layouts are tested; Wi-Fi isolation and physical
      device performance still require the actual phone/network.

## Superseded / outside scope

- The separate live PR plan was superseded by direct-to-main pushes.
- Preserving the 2D prototype was superseded by deleting it.
- Header/hero/card-dashboard layouts were superseded by edge-only glass overlays.
- Identity voting, a human hider, hosting deployment, teammate invitations and a
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
