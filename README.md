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

For an immediate movement demo, open **http://localhost:4173/practice** or choose **Try pet movement**. Send the pack to watch ten guardians travel to different rooms, or select one guardian and click a room. **Todd, run!** moves the visible practice hider. **Loop tour** repeats excursions for a shared screen; **Pause** freezes travel and sprite playback. Practice is local to the tab and makes no model calls.

Uploads accept ordinary pet images and Codex sprite sheets at **1536×1872** (9 rows) or **1536×2288** (11 rows). The importer preserves all eight columns and transparent cells, compressing the atlas to fit the existing upload limit. Idle and directional running frames play in the castle; a plain image remains a moving billboard. Practice uploads replace the selected guardian's artwork and retain its preset abilities. Live uploads still create model-backed cards.

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
- Bottles cost another 25 usage and disappear after triggering. The hidden Tivo reset restores usage to 100 once. The vet restores up to 50, even from zero. Healing never grants another action.
- Breeding needs reciprocal requests from two players. Both parents spend 20 usage and their actions. The faster parent owns the baby; ties use a stable pet ID ordering. The baby can act next round. A room can grow to 20 pets.
- Todd's current location and private game objects are excluded from client state. A brief fictional move summary and its previous location appear after resolution. Todd moves again before the next round opens.

## Audience

The host shows one card for the seekers and one for Todd. **Measure cheering** requests microphone access and measures each side for three seconds, with a short gap between sides. The larger average wins. Scores within 0.015 tie and grant no advantage. Permission failures leave the labelled **Manual fallback** available.

Only one result is accepted per round. Seekers can hear a regional squeak or rule out two rooms. Todd can relocate once more or temporarily gain attic access. Results carry the round and hunt identity so a late result cannot affect a later round. The microphone stops after measuring, cancellation, navigation, or a phase change.

## Rendering and controls

Drag the castle to orbit; scroll or pinch to zoom. Click a room marker or open **Rooms** in the left overlay for keyboard-accessible room buttons. **Reset view** restores the camera. **Simple view** stops 3D rendering and keeps all controls available. WebGL failures use the same fallback. The castle fills the viewport. All controls live in transparent glass overlays at the left and right edges. Players, log and rules open on demand.

When any pet enters an interior location, the upper castle lifts and fades to reveal furnished rooms. It closes when every pet leaves. **Look inside** previews the cutaway without moving a pet. Pet and roof animation respect reduced-motion preferences.

Resolved moves follow world-space routes through the grounds, terrace, entrance and corridor. Flight routes rise above the building; speed changes travel time. Route lines and name tags make journeys visible. The host's **Next round** waits for the local travel animation to finish. Todd appears in the lobby and at the round reveal; its active hiding location remains excluded from client state. See [movement notes](docs/MOVEMENT.md) for controls, implementation boundaries and verification.

The 2D prototype and its engine have been removed. The 3D game is the only experience.

## Checks and production build

```bash
npm test          # game rules, transport, model adapter, movement and sprite frames
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
