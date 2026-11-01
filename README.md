# Promptkeep

A live castle hide-and-seek game for the London OpenAI hackathon. Up to ten phone players bring a pet, submit a move each round, and try to catch Todd, an AI-controlled dot. The host runs the hunt on a shared screen.

The interactive 3D grounds are inspired by Ardross Castle, the filming location used by The Traitors. The castle model is original procedural geometry, with a sandstone façade, square entrance tower, slate roofs, turrets, terrace stairs, gardens and woodland. It is a game map, not a reconstruction of the real floor plan.

## Start the game

Use Node.js 22 or later.

```bash
npm ci
npm run dev
```

Open **http://localhost:4173** on the host laptop. Click **Create room**, then let players scan the QR code or open the displayed join link on the same Wi-Fi. The host can start with 1–10 players. A description is enough to join; a resized PNG, JPEG or WebP image is optional.

The QR code uses a detected LAN address. If the laptop has multiple networks, edit **Connection settings → Host address** on the host screen. Phones must use the laptop's address, not `localhost`. Venue Wi-Fi may isolate devices; a shared hotspot can help. The host microphone works on `localhost` or HTTPS. Players do not need microphone access.

The game works without an API key, using clearly marked offline cards and moves. To enable model-backed play:

```bash
cp .env.example .env.local
```

Add `OPENAI_API_KEY` to `.env.local` locally, then restart `npm run dev`. Never paste a key into chat, commit it, or use a `VITE_` environment variable for it. `OPENAI_MODEL` defaults to `gpt-4.1-mini` and can be changed to a compatible model with image input and structured Responses output. The model receives the uploaded image/description for cards and the seeking prompt for moves. Audio is never uploaded. Model failures and malformed responses fall back to offline rules and are labelled.

## Play

- **Four rounds; one capture wins.** Ten human seekers stay human-controlled. Todd is a separate shadow, rendered as a dark dot with white eyes.
- Each pet has **20 points** split across flight, smallness, speed, climb and swim, with each stat between 1 and 8. A score of 5 unlocks that stat's room. Higher smallness means better access to narrow gaps. Speed also decides resolution order.
- Todd starts from a seeker's card, redistributing points until its unlocked abilities differ from every original seeker. Its hiding spot must be legal for Todd and reachable by at least one ready seeker.
- Each **player** submits one action per round, even if they own a baby. Seeking costs 10 usage. Prompts rotate through eight words, emoji only, two rhyming lines, then eight words.
- The host resolves submitted moves together. Missing players rest; the host confirms before skipping them. Refreshing a tab restores its session and the latest room state.
- Bottles cost another 25 usage and disappear after triggering. The hidden Tibo reset restores usage to 100 once. The vet restores up to 50, even from zero. Healing never grants another action.
- Breeding needs reciprocal requests from two players. Both parents spend 20 usage and their actions. The faster parent owns the baby; ties use a stable pet ID ordering. The baby can act next round. A room can grow to 20 pets.
- Todd's current location and private game objects are excluded from client state. A brief fictional move summary and its previous location appear after resolution. Todd moves again before the next round opens.

## Audience

The host shows one card for the seekers and one for Todd. **Measure cheering** requests microphone access and measures each side for three seconds, with a short gap between sides. The larger average wins. Scores within 0.015 tie and grant no advantage. Permission failures leave the labelled **Manual fallback** available.

Only one result is accepted per round. Seekers can hear a regional squeak or rule out two rooms. Todd can relocate once more or temporarily gain attic access. Results carry the round and hunt identity so a late result cannot affect a later round. The microphone stops after measuring, cancellation, navigation, or a phase change.

## Rendering and controls

Drag the castle to orbit; scroll or pinch to zoom. Click a room marker or open **Rooms** in the left overlay for keyboard-accessible room buttons. **Reset view** restores the camera. **Simple view** stops 3D rendering and keeps all controls available. WebGL failures use the same fallback. The castle fills the viewport. All controls live in transparent glass overlays at the left and right edges. Players, log and rules open on demand.

When any pet enters an interior location, the upper castle lifts and fades to reveal furnished rooms. It closes when every pet leaves. **Look inside** previews the cutaway without moving a pet. Pet and roof animation respect reduced-motion preferences.

The 2D prototype and its engine have been removed. The 3D game is the only experience.

## Checks and production build

```bash
npm test          # 15 live engine, transport, and Socket.IO integration tests
npm run typecheck
npm run build
npm start         # serves dist and the room server at http://localhost:4174
```

`npm run preview` serves only static assets and does not run the room server. Use `npm start` to test the full production build. Set `PORT` and optionally `PUBLIC_URL` for a different local address. This project has not been deployed.

Rooms, uploaded images, and reconnect identities are in memory. Restarting the server clears them. Session credentials stay in each browser tab's session storage; losing the host tab's storage loses its controls. At most 12 rooms are retained; rooms idle for six hours are cleared when a new room is created. This is a LAN hackathon build, without accounts or durable persistence.

Verified and pending checks are in [PLAN.md](PLAN.md), with details in [docs/VERIFICATION.md](docs/VERIFICATION.md). Live model calls still need a working key. Physical-phone networking and microphone hardware require venue/device testing. Usage is fictional game health, not OpenAI account credit.

## Code map

- `server/rooms.ts`: authoritative room state, hidden objects, turns, abilities and outcomes.
- `server/brain.ts`: structured OpenAI cards, moves and hider choices, with offline fallbacks.
- `server/index.ts`: HTTP routes, Socket.IO sessions, reconnects and static hosting.
- `src/live/`: host/player screens, 3D castle, cheering, shared contracts and validation.
- `src/pets.ts`, `src/PetAvatar.tsx`: shared pet data and original avatar artwork.

Development milestones are pushed directly to `main`, as requested. The GitHub Actions template is in `docs/github-actions-check.yml`; move it to `.github/workflows/check.yml` using a login with workflow permission to enable CI. The current login could push code but GitHub rejected workflow creation, so CI is not installed.

## Expanded estate

The map now has 30 hiding places across connected gardens, the ground floor, two upper floors and the dark cellars. The grounds include a lake, boathouse, orchard, glasshouse, pavilion, OpenAI-knot hedge maze, pet graveyard and Ivory Tower. The crypt lives in the graveyard. The cellar cutaway lifts into view for inspection; it is a game cross-section rather than a real floor plan.

Click the light rings to select destinations. Hover shows access rules and a description. Rooms has a search box; phone players can use those same buttons. Previous/next floor buttons wrap through Cellars, Ground, First and Second; the dropdown jumps directly. Moving to an upper room automatically reveals its floor. Right-drag pans; pinch/scroll zooms.

Large pets (smallness 3 or less) reach the belfry rope; tiny pets reach burrows and drains. Water rooms require swimming, high rooms require flight, and cats, owls and ghosts have night vision for the crypt and cold storage. Some specialist destinations require 6 rather than 5 points. Cards retain the 20-point budget.

The nursery reveals a bed with an animated duvet and floating hearts during reciprocal breeding. The clinic reveals a treatment table, IV stand and healing cross. Hidden Temperature 2.0 bottles cost 25 extra usage, make pets visibly tipsy, and reduce move priority by 2 without changing room access. Tipsiness lasts until the vet, Tibo reset, or a new hunt; babies do not inherit it. Discovered bottles and the reset button appear briefly beside the discovering pet. Their hidden locations remain server-only.

Sixteen original fictional pixel-pet ancestor portraits hang across the rooms. Select Hallucination Hall to inspect their histories. Petdex shows each current pet's card, traits, lineage and reachable places, with a link to the external Petdex gallery. No external pet downloads or account installs are automatic.

The hedge silhouette uses the [OpenAI icon from Bootstrap Icons](https://icons.getbootstrap.com/icons/openai/), with its MIT license included in `public/bootstrap-icons-LICENSE.txt`. Portrait art was generated specifically for this game.
