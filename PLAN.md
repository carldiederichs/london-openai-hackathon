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
