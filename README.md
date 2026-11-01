# Feral

Live castle: https://feral-shared-castle.drizzle-fencing-0v.chatgpt.site

Phone controls: https://feral-shared-castle.drizzle-fencing-0v.chatgpt.site/join

A shared pet castle for the London OpenAI hackathon. Up to 300 guests scan one QR code, choose a ChatGPT companion or upload their own pet, and hold the arrows on their phones to walk around the same grounds. The castle fills the main screen.

Open `/` on the main screen and `/join` on phones. Five existing ChatGPT pets—Codex, Dewey, Fireball, Hoots and Seedy—are available in a swipeable chooser. Upload accepts an image or a ChatGPT sprite sheet (1536 × 1872 or 1536 × 2288). Joining needs no account. Private ChatGPT pet libraries cannot be imported automatically by signed-out visitors.

The previous turn-based Todd hunt remains available at `/hunt` and its `/host/:code` and `/play/:code` links.

The interactive 3D grounds are inspired by Ardross Castle, the filming location used by The Traitors. The castle model is original procedural geometry, with a sandstone façade, square entrance tower, slate roofs, turrets, terrace stairs, gardens and woodland. It is a game map, not a reconstruction of the real floor plan.

## Start the game

Use Node.js 22 or later.

```bash
npm ci
npm run dev
```

Open **http://localhost:4173** on the main screen, then scan its QR code from phones on the same Wi-Fi. Choose a companion and hold the directional arrows to move. For the older round-based hunt, open `/hunt` and create a room.

For a local rehearsal, open **http://localhost:4173/practice** and choose **Start · 1 minute**. The large clock counts down from 1:00; pets with usage remaining at zero share the win. The pack moves automatically, or select a pet and click a room. Practice moves cost 10 usage and the vet restores 50. **More** contains image upload, movement pause, auto-move and reset. Pausing movement does not pause the clock. Practice is local to the tab, makes no model calls, and omits the live game's hidden bottles and audience votes. Choose **Mating room** for two pets to rehearse their merge.

Uploads accept ordinary pet images and Codex sprite sheets at **1536×1872** (9 rows) or **1536×2288** (11 rows). The importer preserves all eight columns and transparent cells, compressing the atlas to fit the existing upload limit. Idle and directional running frames play in the castle; a plain image remains a moving billboard. Practice uploads replace the selected guardian's artwork and retain its preset abilities. Live uploads still create model-backed cards.

The QR code uses a detected LAN address. If the laptop has multiple networks, edit **Connection settings → Host address** on the host screen. Phones must use the laptop's address, not `localhost`. Venue Wi-Fi may isolate devices; a shared hotspot can help. The host microphone works on `localhost` or HTTPS. Players do not need microphone access.

The game works without an API key, using clearly marked offline cards and moves. To enable model-backed play:

```bash
cp .env.example .env.local
```

Add `OPENAI_API_KEY` to `.env.local` locally, then restart `npm run dev`. Never paste a key into chat, commit it, or use a `VITE_` environment variable for it. `OPENAI_MODEL` defaults to `gpt-4.1-mini` and can be changed to a compatible model with image input and structured Responses output. The model receives the uploaded image/description for cards and the seeking prompt for moves. Audio is never uploaded. Model failures and malformed responses fall back to offline rules and are labelled.

## Anonymous joining and capacity

Players do not need a ChatGPT account or Sign in with ChatGPT. Joining creates an anonymous game session; host controls and pet ownership still use separate session credentials. On ChatGPT Sites, the hosting audience must also allow public access for signed-out visitors; a platform sign-in gate is separate from the game code.

Rooms admit up to 300 players, including concurrent joins. The shared-IP join budget allows 600 attempts per minute, separately from the 40-per-minute room-creation budget, so venue Wi-Fi does not stop at 40 players. This raises admission capacity; it is not evidence of 300-phone rendering or continuous-movement performance.

## Hunt mode (`/hunt`)

- **One minute; surviving pets win.** The server starts the 60-second deadline when the initial hiding step completes. At zero, ready pets with usage above zero win for their owners; ties share the win and zero survivors means no winner. Capturing Todd no longer ends the hunt, and rounds can continue until the deadline. Up to 300 human seekers stay human-controlled. Todd is a separate shadow, rendered as a dark dot with white eyes.
- Each pet has **20 points** split across flight, smallness, speed, climb and swim, with each stat between 1 and 8. A score of 5 unlocks that stat's room. Higher smallness means better access to narrow gaps. Speed also decides resolution order.
- Todd starts from a seeker's card, preferring an ability combination that differs from every original seeker. If the crowd covers every combination, Todd receives a distinct stat allocation under the same 20-point budget. Its hiding spot must be legal for Todd and reachable by at least one ready seeker.
- Each **player** submits one action per round, even if they own a baby. Seeking costs 10 usage. Prompts rotate through eight words, emoji only, two rhyming lines, then eight words.
- The host resolves submitted moves together. Missing players rest; the host confirms before skipping them. Refreshing a tab restores its session and the latest room state.
- Bottles cost another 25 usage and disappear after triggering. The red Tibo reset beneath his tavern portrait restores usage to 100 for the first searching pet each hunt. The vet restores up to 50, even from zero. Healing never grants another action.
- Entering the mating room reserves one of two places. When both pets arrive, an eight-second floating duvet and rising hearts precede their merge into one new pet. Both players own it; either can submit its single shared action. Its balanced card averages both parents; usage is their combined remaining usage minus 40, capped at 100. Parents are replaced, and restarting restores the original roster. The room stays full through the animation; a lone waiting pet can leave.
- Todd's current location and private game objects are excluded from client state. A brief fictional move summary and its previous location are available in the Log after resolution. Todd moves again before the next round opens.

## Audience

The host shows one card for the seekers and one for Todd. **Measure cheering** requests microphone access and measures each side for three seconds, with a short gap between sides. The larger average wins. Scores within 0.015 tie and grant no advantage. Permission failures leave the labelled **Manual fallback** available.

Only one result is accepted per round. Seekers can hear a regional squeak or rule out two rooms. Todd can relocate once more or temporarily gain attic access. Results carry the round and hunt identity so a late result cannot affect a later round. The microphone stops after measuring, cancellation, navigation, or a phase change.

## Rendering and controls

Drag the castle to orbit; scroll or pinch to zoom. Click a room marker or open **Rooms** in the left overlay for keyboard-accessible room buttons. The **··· camera menu** contains zoom, Follow pet and Reset view. **Simple view** stops 3D rendering and keeps all controls available. WebGL failures use the same fallback. The castle fills the viewport. Controls live in transparent glass overlays at the left and right edges; the large countdown sits at the top centre. Players, log and rules open on demand.

When any pet enters an interior location, the upper castle lifts and fades to reveal furnished rooms. It closes when every pet leaves. **Look inside** previews the cutaway without moving a pet. Pet and roof animation respect reduced-motion preferences.

The shared world reuses the existing 3D castle. The phone controller includes a lightweight position map.

Resolved moves follow world-space routes through the grounds, terrace, entrance and corridor. Flight routes rise above the building; speed changes travel time. Jointed 3D legs, distance-driven strides, wingbeats, smooth turns, route lines and name tags make journeys visible. All 42 destinations share the same coordinate layout as the rendered rooms and gardens. The host's **Next round** waits for the local travel animation to finish. Todd appears in the lobby and at the round reveal; its active hiding location remains excluded from client state. See [movement notes](docs/MOVEMENT.md) for controls, implementation boundaries and verification.



## Checks and production build

```bash
npm test          # game rules, admission, movement, sprites and shared-world transport
npm run typecheck
npm run build:local
npm start         # serves dist and the room server at http://localhost:4174
```

`npm run preview` serves only static assets and does not run the room server. Use `npm start` to test the full production build. Set `PORT` and optionally `PUBLIC_URL` for a different local address. The Sites deployment uses `npm run build`; its shared-world API is independent of the local Node hunt server.

The server finishes hunt mode at the deadline even without connected clients. Reconnecting restores the original deadline; late model responses cannot change a finished hunt. An action still waiting on the model at the bell is not applied.

The local server keeps the shared world, rooms, uploaded images, and reconnect identities in memory. Restarting the server clears them. Session credentials stay in each browser tab's session storage; losing the host tab's storage loses its controls. At most 12 rooms are retained; rooms idle for six hours are cleared when a new room is created. Local play requires a reachable server. Production uses only ChatGPT Sites hosting and its managed database; see [shared-world deployment](docs/SHARED_WORLD.md).

Verified and pending checks are in [PLAN.md](PLAN.md), with details in [docs/VERIFICATION.md](docs/VERIFICATION.md). Live model calls still need a working key. Physical-phone networking and microphone hardware require venue/device testing. Usage is fictional game health, not OpenAI account credit.

## Code map

- `server/rooms.ts`: authoritative room state, hidden objects, turns, abilities and outcomes.
- `server/brain.ts`: structured OpenAI cards, moves and hider choices, with offline fallbacks.
- `server/index.ts`: HTTP routes, Socket.IO sessions, reconnects and static hosting.
- `src/live/`: host/player screens, 3D castle, cheering, shared contracts and validation.
- `src/pets.ts`, `src/PetAvatar.tsx`: shared pet data and original avatar artwork.

Development milestones are pushed directly to `main`, as requested. The GitHub Actions template is in `docs/github-actions-check.yml`; move it to `.github/workflows/check.yml` using a login with workflow permission to enable CI. The current login could push code but GitHub rejected workflow creation, so CI is not installed.

## Expanded estate

The map has 42 hiding places, including 26 furnished rooms on one massive playable ground floor. Four connected sandstone ranges enclose a broad central fountain courtyard. Matching façades, pitched and hipped slate roofs, a dominant keep and corner turrets make one castle. The upper windows and towers are exterior decoration; no floor switching is required. The enlarged grounds span the castle frontage, with a lake, boathouse, orchard, glasshouse, pavilion, OpenAI-knot hedge maze, pet graveyard and Ivory Tower. The crypt lives in the graveyard; the dark rooms occupy ground-floor wings.

Click the light rings to select destinations. Hover shows access rules and a description. Rooms has a search box; phone players can use those same buttons. Selecting an interior opens the cutaway. **Follow pet** follows the selected guardian through the estate; **Reset view** returns to the overview. Right-drag pans; pinch/scroll zooms.

Large pets (smallness 3 or less) reach the belfry rope; tiny pets reach burrows and drains. Water rooms require swimming, high rooms require flight, and cats, owls and ghosts have night vision for the crypt and cold storage. Some specialist destinations require 6 rather than 5 points. Cards retain the 20-point budget.

The nursery reveals a bed with an animated duvet and floating hearts when both mating-room pets arrive. The clinic reveals a treatment table, IV stand and healing cross. Hidden Temperature 2.0 bottles cost 25 extra usage, make pets visibly tipsy, and reduce move priority by 2 without changing room access. Tipsiness lasts until the vet, Tibo reset, or a new hunt; babies do not inherit it. Discovered bottles and the reset button appear briefly beside the discovering pet. Bottle locations remain server-only; the reset now lives beneath Tibo’s tavern portrait.

Sixteen original fictional pixel-pet ancestor portraits hang across the rooms. Select Hallucination Hall to inspect their histories. Petdex shows each current pet's card, traits, lineage and reachable places, with a link to the external Petdex gallery. No external pet downloads or account installs are automatic.

The hedge silhouette uses the [OpenAI icon from Bootstrap Icons](https://icons.getbootstrap.com/icons/openai/), with its MIT license included in `public/bootstrap-icons-LICENSE.txt`. Portrait art was generated specifically for this game.

The ground-floor tavern includes a framed pixel-art portrait of Thibault “Tibo” Sottiaux,
with the fictional game plaque “Keeper of the Reset”. Generated with the built-in image tool to match the pet portraits; identity reference:
[Tibo's public GitHub profile](https://github.com/thsottiaux)
([original avatar](https://github.com/thsottiaux.png), retrieved 1 November 2026).
The source photo is retained as a reference; no endorsement is implied.

Portrait generation prompt: preserve Tibo’s recognizable face, smile and head tilt;
match the pet atlas’s chunky pixel art, warm candlelight, dark mansion backdrop
and antique clothing. One square bust, no text or frame.
Asset: `public/tibo-pixel.png`.

Max’s companion update (`9fb5bc8`) is integrated selectively: ten original Codex sprite sheets in the live join picker and **More → Codex companions** in practice. Practice companion selection changes artwork while keeping the selected guardian’s card; live joining scores a fresh balanced card. Existing 3D guardians, castle geometry and routes remain available.
