# Feral

**Feral is a live multiplayer pet hunt inside an AI-haunted castle.** Put the mansion on the big screen, let players scan the QR code, and give everyone one minute to find the hidden OpenAI Dot—or finish with the most usage remaining.

Built for the London OpenAI hackathon, Feral supports rooms of up to **300 players plus a host**. Players steer their pets from a phone; the shared screen renders the whole estate. The castle is inspired by Ardross Castle, the filming location used by *The Traitors*. Its procedural geometry is original, not a reconstruction of the real floor plan.

## Start Feral locally

Use Node.js 22 or later.

```bash
npm ci
npm run dev
```

1. Open **http://localhost:4173** on the host laptop and choose **Create room**.
2. Put the host's mansion view on the big screen. Players scan its QR code or open the join link on the same Wi-Fi.
3. Players swipe through the ten Codex companions, or bring an image or description of their own pet. Give the pet a name and join.
4. Press **Start** beside the large timer. Players hold the phone's arrow buttons, or use **WASD / arrow keys** on a keyboard, to move through the estate. Entering a room searches it automatically.

The timer has **Start**, **Stop** and **Resume** controls. The host’s **Stop** pauses the whole game: the countdown, pet movement, usage drain and breeding. **Resume** continues from the same remaining time. Players cannot pause the game.

The QR code uses a detected LAN address. If the laptop has multiple networks, edit **Connection settings → Host address** on the host screen. Phones must use the laptop's address, not `localhost`. Venue Wi-Fi may isolate devices; a shared hotspot can help. Joining is a game session, not an account sign-up.

## How to win

- **Find the Dot:** the server hides Todd, the OpenAI Dot, in a legal room before the countdown starts. The first living pet to enter its room wins immediately. The location stays out of client state until the game ends.
- **Beat the clock:** if nobody finds the Dot in 60 seconds, the pet with the highest remaining usage wins. Exact ties share the win; pets at zero cannot win. Both owners of a merged winning pet win together.
- **Keep moving carefully:** usage is fictional game health, not OpenAI account credit. It drains over time, with extra drain while moving. At zero, a pet cannot move again until the next game.
- **Use your abilities:** every card has 20 points across flight, smallness, speed, climb and swim. Room gates enforce those abilities on the server. Higher smallness helps with narrow entrances; some rooms also require night vision or a specialist score.
- **Recover:** the vet restores up to 50 usage and cures tipsiness. Tibo's red reset button beneath his tavern portrait restores usage to 100 for its first visitor each hunt. Hidden bottles cost 25 usage and make a pet tipsy and slower until healed.
- **Traitors:** one player per full group of nine is secretly assigned a traitor role (9–17 players: one; 18–26: two). A moving traitor who bumps into a seeker bans it for distillation. The pet immediately appears in the graveyard, its controls lock, and its phone displays a death message. Base camp is safe; bans have a two-second cooldown. A merged pet inherits a traitor role if either owner is a traitor. Roles reset each game.
- **Merge:** the mating room admits only two pets from different owners, each with at least 20 usage. Once both arrive, a floating duvet and rising hearts play for eight seconds. The parents become one new, balanced pet controlled by both players. Its usage is their combined remaining usage minus 40, capped at 100. A lone waiting pet can leave.

Phone controls unlock only when the host starts the countdown. The host and phones display the same server-owned deadline. The phone controller shows your pet, usage and position on a small map. **Go to vet** and **Mating room** follow the estate's paths automatically; steering manually takes over. The server enforces movement, room access, occupancy and outcomes. Refreshing a tab reconnects to the same session and deadline. Restarting a hunt restores the original pets.

## Pets

Max's companion update (`9fb5bc8`) supplies the default roster: **Dewey, Fireball, Hoots, Rocky, Seedy, Stacky, BSOD, Null Signal, Codex and Tung Tung**. Their original sprite sheets are served locally and animate at rest and while running. Built-in companions use balanced preset cards, so selecting one needs no model request or image upload.

Custom uploads accept PNG, JPEG and WebP images, including Codex sprite sheets at **1536×1872** (9 rows) or **1536×2288** (11 rows). The importer preserves all eight columns and transparent cells while resizing to the upload limit. A plain image becomes a moving billboard; description-only pets use the game's 3D models. See [sprite provenance](public/pets/README.md) and `public/pets/manifest.json` for the imported assets. These assets retain their original ownership.

## Local practice

Open **http://localhost:4173/practice** and choose **Start** beneath the timer to rehearse without phones or a server room. Select a pet, then click a room marker or choose a destination from **Move to…**. The pack can also move automatically. Practice has the hidden-Dot win and highest-usage timeout rules, plus the two-pet merge animation.

Practice is local to the tab and makes no model calls. It uses discrete moves costing 10 usage, rather than live steering's continuous drain, and the vet restores 50. It omits live hidden bottles and audience interventions. **Stop** beside the timer pauses practice’s clock, movement and breeding; **Resume** continues them. **More** contains companion selection, image upload, auto-move and reset. Auto-move controls only the pack’s automatic trips, not the game timer.

## Castle and controls

The castle fills the host viewport, with glass controls at the sides and a large countdown at the top centre. Drag to orbit, right-drag to pan, and scroll or pinch to zoom. Click a light ring to select a destination; hover to inspect its access rules. **Rooms** provides searchable, keyboard-accessible destinations. The **··· camera menu** contains zoom, Follow pet and Reset view. **Simple view** stops 3D rendering while keeping controls available; WebGL failures use the same fallback.

When a pet enters the mansion, the upper castle lifts and fades to reveal the rooms. **Look inside** previews this cutaway without moving a pet. Pet and roof animations respect reduced-motion preferences. The phone controller does not render the full 3D castle.

The estate has **42 hiding places, including 26 furnished rooms on one playable ground floor**. Four connected sandstone ranges surround a fountain courtyard. Upper windows and towers are exterior decoration; no floor switching is needed. The grounds include a lake, boathouse, orchard, glasshouse, pavilion, OpenAI-knot hedge maze, pet graveyard and Ivory Tower. The crypt and dark rooms remain part of the same playable map.

Room details include kitchen pots, dining settings, musical instruments, an observatory telescope, laboratory bottles, server lights, chapel candles and nursery bedding. Garden lanterns light the paths. Sixteen fictional pixel-pet ancestor portraits hang throughout the mansion. **Petdex** shows cards, traits, lineage and reachable places, plus a link to the external Petdex gallery; it does not install or download pets automatically.

Static room props are batched, sprite images are shared, and crowded scenes reduce labels and use sprite artwork for pets without uploaded images. Real-time positions come from the server and interpolate on the host. See [movement notes](docs/MOVEMENT.md) for the route graph and earlier movement milestones. The old 2D prototype has been removed.

## Optional AI

Feral works without an API key. To enable model-generated custom cards and the initial hiding choice:

```bash
cp .env.example .env.local
```

Add `OPENAI_API_KEY` to `.env.local`, then restart `npm run dev`. Never commit the key or use a `VITE_` variable for it. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; alternatives must support image input and structured Responses output. Custom card generation sends the supplied image or description to the model. Built-in companions and real-time steering do not require model calls. Failures and malformed responses fall back to validated offline rules.

The earlier turn-based engine remains in the code for compatibility and tests. It includes prompted moves, host resolution and audience cheering. New rooms use real-time steering; those turn-based rules are not the current game loop. Cheering code measures volume locally and never uploads audio; it is not required for a live Feral game.

## Checks and production build

```bash
npm test          # game rules, transport, movement and sprite frames
npm run typecheck
npm run build
npm run test:load # 300 simulated players plus a host over WebSockets
npm start         # serves dist and the room server at http://localhost:4174
```

The local load check connects **301 WebSocket clients**, sends movement inputs from 300 players for 12 seconds, and checks that every player receives motion updates without an unexpected disconnect. It reports event-loop delay, CPU time, received bytes and memory use. This is a local capacity check, not a guarantee for venue Wi-Fi, physical phones or a deployed server.

`npm run preview` serves the production frontend, configured by `.env.production` to use the Cloudflare backend. Development remains local Socket.IO. To build for a local Node production server, run `VITE_GAME_BACKEND= VITE_GAME_TRANSPORT= npm run build`, then `npm start`. Set `PORT` and optionally `PUBLIC_URL` for a different local server address.

The server owns the deadline and ends an unpaused game even without connected clients. While the host has stopped the game, the deadline and breeding timers remain frozen. Reconnecting does not reset the clock. Phones receive their owned pet's updates; the host receives the whole world's positions.

In the local Node server, rooms, uploaded images and reconnect identities are held in memory. Restarting the server clears them. Session credentials live in each tab's session storage; losing the host tab's storage loses its controls. At most 12 rooms are retained, and rooms idle for six hours are cleared when a new room is created. The deployed Durable Object backend persists room snapshots and uploads; this local limitation does not apply to it. Neither mode provides durable user accounts.

See [PLAN.md](PLAN.md) and [verification notes](docs/VERIFICATION.md) for completed checks and outstanding work. A live `gpt-4.1-mini` custom-card request returned an AI-labelled, balanced 20-point card. The local hiding and legacy move model paths have also returned AI mode. Physical-phone networking still requires its own checks; microphone hardware testing remains user-owned.

## Cloudflare and Sites

Live game: [https://feral-hackathon.sugarybrine.chatgpt.site](https://feral-hackathon.sugarybrine.chatgpt.site). The Sites frontend and Durable Object backend are published with the synchronized start, traitors, graveyard elimination and phone control fixes.

The browser frontend is packaged for Sites. Its public backend is `https://feral-game.maxmelander03.workers.dev`. `.env.production` contains only that public URL and the native WebSocket transport choice. The OpenAI key is a Cloudflare Worker secret, never a frontend variable.

Each room has one Durable Object running the same `Rooms` engine as local development. It owns movement, the hidden Dot, usage, merging and the deadline. Snapshots are saved every second and after important actions; uploads are stored separately. A sudden isolate restart can lose up to one second of movement. An alarm enforces the deadline if every client disconnects. Host and player credentials remain in tab session storage.

```bash
npm run worker:check
npm run worker:deploy
npx wrangler secret put OPENAI_API_KEY
GAME_BACKEND=https://feral-game.maxmelander03.workers.dev PLAYERS=2 npm run test:durable
```

For local Durable Object testing, run `npm run worker:dev`, then `VITE_GAME_BACKEND=http://localhost:8787 VITE_GAME_TRANSPORT=durable npm run dev:web`. The normal `npm run dev` still uses the local Node backend. `PLAYERS=300 npm run test:durable` checks the full native-WebSocket crowd; set `GAME_BACKEND` to the tested server URL. Do not run it in a room used by players: it creates a separate test room.

## Code map

- `server/rooms.ts`: authoritative movement, room state, hidden objects, abilities and outcomes.
- `server/brain.ts`: structured OpenAI cards, moves and hiding choices, with offline fallbacks.
- `worker/index.ts`: Durable Object transport, snapshots, uploads and venue admission limits.
- `src/live/durable-client.ts`: authenticated native WebSocket connection and reconnect.
- `server/index.ts`: HTTP routes, Socket.IO sessions, movement broadcasts, reconnects and static hosting.
- `src/live/WorldController.tsx`: phone direction pad, keyboard movement and care shortcuts.
- `src/live/CastleWorld.tsx`: the castle, gardens, pet animation and cutaway rendering.
- `src/live/movement.ts`, `src/live/mating.ts`: shared route and merge rules.
- `src/pets.ts`, `src/PetAvatar.tsx`: default companion roster and avatars.
- `scripts/load-realtime.ts`: local 300-player WebSocket load check.

Development milestones are pushed directly to `main`. The GitHub Actions template is in `docs/github-actions-check.yml`; installing it as `.github/workflows/check.yml` needs a login with workflow permission. The current login could push code but GitHub rejected workflow creation, so CI is not installed.

## Artwork and credits

Max's original companion assets were integrated selectively to preserve the castle and current interface. Compatible controls and rate-limit improvements from Owen's PR #3 were ported into this game; its separate sandbox and Cloudflare worker were not substituted for the existing castle and hunt. The hedge silhouette uses the [OpenAI icon from Bootstrap Icons](https://icons.getbootstrap.com/icons/openai/), with its MIT license in `public/bootstrap-icons-LICENSE.txt`. The mansion's pet portraits were generated for this game.

The tavern contains a pixel-art portrait of Thibault “Tibo” Sottiaux with the fictional plaque **Keeper of the Reset**. It was generated to match the pet portraits: a square bust with his recognizable face, smile and head tilt, warm candlelight, chunky pixels, antique clothing and a dark mansion backdrop. The asset is `public/tibo-pixel.png`. Identity reference: [Tibo's public GitHub profile](https://github.com/thsottiaux) and [original avatar](https://github.com/thsottiaux.png), retrieved 1 November 2026. The source photo is retained as a reference; no endorsement is implied.
