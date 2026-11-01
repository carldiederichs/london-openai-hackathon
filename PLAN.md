# Promptkeep task checklist

This is the authoritative checklist for the hackathon game. `docs/LIVE_GAME.md`
contains design detail, not a second task list. PR #1 records the first local prototype. The latest user instruction is to push
verified milestones directly to main, superseding the separate live PR plan.

## Verified milestones

- [x] Create the public GitHub repository with a README. Repository and visibility verified.
- [x] Build the shared-screen prototype: illustrated castle, ten pets, image uploads,
      ability-gated hiding spots, movement/search, escaping Dot, usage limits, bottle
      traps, hidden Tivo reset, breeding, vet, rounds, endings, and restart.
- [x] Verify the prototype: 14 rule tests and production build passed; browser checked
      upload, ability gating, search, breeding, baby readiness, healing, keyboard tabs,
      round confirmation, defeat, restart, and phone layout.
- [x] Push the prototype and make PR #1 ready before live expansion. Fresh GitHub
      check on 2026-11-01: open, non-draft, mergeable, head `f47a33a`. No merge requested.
- [x] Review the supplied OpenAI Showcase; relevant game and API references are in
      `docs/LIVE_GAME.md`.

## Live implementation

- [x] Render the existing local page early: development server and browser open at
      http://localhost:4173. Render the new 3D scene as soon as its first version exists.

- [ ] **In progress**: Build a real 3D castle with camera controls, clickable hiding spots, animated pet
      movement, and Todd as an OpenAI-style dot. Check WebGL rendering, location picking,
      phone performance, and a usable fallback when WebGL is unavailable.
- [ ] Push verified milestones regularly directly to main. Check remote commit identity after each push. Server milestone and delivery preference pushed to main at `5706304`.

- [ ] **In progress**: Finalize live rules and keep the prototype's rules explicit.
      Live rules: four rounds, one capture, ten human seekers, and Todd as the AI shadow
      hider, rendered as an OpenAI-style dot. Todd gets distinct abilities from the
      other pets within the same 20-point budget. Use reciprocal breeding submissions
      for consent; the first parent owns the baby. Check: instructions and engine agree.
- [x] Add an authoritative room server, a host screen, QR/code joining, ten phone
      player slots, reconnect handling, host-only round controls, and simultaneous
      submissions. Check: separate browser clients joined, refreshed/reconnected, and submitted moves; server tests reject cross-player and host controls.
- [x] Support image upload and a pet-description fallback during joining, with a
      usable sprite/card for either input. Check native pet import only if a supported
      format is documented; do not depend on private desktop storage or venue Wi-Fi.
- [x] Score pet cards using structured model output and enforce a fixed 20-point
      budget across flight, smallness, speed, climb, and swim. Check: malformed totals
      are normalized/rejected, ability gates work, and every stat affects gameplay. Offline cards and gates verified; real API calls remain separately blocked.
- [ ] Add constrained seeking prompts (word limit, emoji, rhyme), model-to-move
      interpretation, and deterministic validation of ownership, action costs, and
      accessible destinations. Check invalid/late/duplicate submissions and AI failures.
- [ ] Add the AI-controlled hider, legal movement, a short fictional explanation,
      a misleading public claim, and a final reveal. Check that active hiding locations
      are not included in player/public state or explanations that spoil the hunt.
- [x] Carry breeding, vet recovery, bottle traps, usage exhaustion, and the hidden
      Tivo reset into live mode. Check simultaneous resolution, consent, baby ownership,
      and no extra actions from healing/resetting. Rule tests pass; browser checked reciprocal breeding, next-round baby search and capped vet recovery.
- [ ] Add left-versus-right cheering: two visible advantage cards, timed microphone
      measurements, one winning rule change per round, and a labelled manual fallback.
      Check permissions, unavailable microphones, ties, expiry, and only one application.
- [ ] Finish the haunted-castle host presentation, phone controls, visible AI/fallback
      status, action animations, round results, and restart. Check rendered desktop and
      phone layouts and keyboard/reduced-motion behavior.

## Verification and delivery

- [x] Add and run server/rule tests for room isolation, identity, reconnects, limits,
      duplicate round resolution, secret-state filtering, AI fallbacks, and new mechanics. 25 tests pass, including HTTP/Socket.IO integration; typecheck and build pass.
- [ ] Play through separate host and seeker browser sessions; verify multiple players,
      reconnect, every action, one cheering advantage, capture, escape, and reset.
- [ ] **Blocked**: Verify real model-backed cards, seeker moves, and hider decisions.
      Prerequisite: a working server-side `OPENAI_API_KEY`. No key was present in the
      process environment on the previous check. Never put the key in source or chat.
- [ ] Verify microphone capture with an available input device and verify joining
      from a real phone on the same network. Keep simulated/browser checks distinct
      from physical-device evidence; venue Wi-Fi client isolation may block LAN access.
- [ ] Run final TypeScript checks, tests, production build, and source review. Preserve
      the first prototype's passing behavior alongside live mode.
- [ ] Update README, setup/fallback instructions, and live-game notes; push the live
      work directly to main as requested, without deploying.
- [ ] Save final verified status and exact continuation in this repository. Carl paused
      all Notion interaction; do not read or write Notion. Keep credential/device gaps visible.

## Superseded, optional, and outside current scope

- The Traitors identity-voting/elimination variant was not selected.
- A human-controlled hider is superseded by the approved AI-controlled hider.
- Three rounds / three sightings remains the local prototype rule, not the proposed
  live rule. Do not silently replace the first PR's behavior.
- Stealth is optional; it is not an extra required stat in the five-stat budget.
- Hosted deployment, public phone access, and teammate invitations were not requested.
  Direct pushes to main are now explicitly requested; they supersede opening a live PR.
- A stage versus table format and exact demo length remain unconfirmed. Use four
  rounds with explicit host pacing; do not invent a timed demo requirement.
