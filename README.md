# Promptkeep

A local castle hide-and-seek game for the London OpenAI hackathon. Ten little guardians search for a slippery Dot, spend usage, discover traps, visit the vet, and breed new companions.

## Run locally

Use Node.js 22 or later and npm.

```bash
npm ci
npm run dev -- --port 4173
```

Open **http://127.0.0.1:4173**. No API key is required. This is a shared-screen prototype: everyone plays in the same browser session. Refreshing the page clears the hunt and uploaded pets.

```bash
npm test       # deterministic game-rule tests
npm run build  # TypeScript checks and production bundle
npm run preview -- --port 4173  # serve the production build
```

## Play

1. Pick a guardian from the roster. Optionally upload a pet image before the first action and choose one or two abilities.
2. Choose a hiding spot on the map, then **Let's investigate**. On a phone-sized screen, the action panel also has a location picker.
3. Every guardian gets one action per round: move and search, breed, or visit the vet.
4. Follow the castle whisper. Find the Dot three times within three rounds to win. It flees after the first two sightings and at the end of each round.
5. Start the next round when the party has finished. The confirmation explains any unused actions you will skip.

| Mechanic    | Rule                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Access      | Pocket-sized pets fit small entrances, flyers reach the tower, night vision handles dark rooms, swimmers reach the moat.                  |
| Search      | Costs 10 usage and one action; includes movement to any accessible room.                                                                  |
| Bottle trap | Costs another 25 usage, never below zero; removed after triggering.                                                                       |
| Tivo reset  | Hidden, single-use button restores its finder to 100 usage after the search cost.                                                         |
| Vet         | Restores 50 usage, capped at 100, for one action. Available at zero usage.                                                                |
| Breeding    | Both parents spend 20 usage and their actions. Baby inherits up to two abilities, starts at 100 usage, and acts from the following round. |
| Rounds      | Three rounds. Usage carries over; actions refresh. The party can grow to 16 pets.                                                         |
| Dot         | Random movement controlled by a seeded game engine. Three discoveries capture it. Old search marks clear whenever it moves.               |

A Dot can flee into a room containing a trap or reset. Searching resolves that room's effect and still counts the sighting. A pet cannot act again simply because the reset restores its usage.

## What's implemented

- Original SVG castle and ten illustrated starter guardians, with responsive controls.
- Deterministic rules separated from the UI and covered by 14 tests.
- Usage, room access, breeding, healing, hidden consumables, round changes, victory and defeat.
- Local PNG, JPEG, WebP, and GIF uploads up to 2 MB. Files remain in the current browser session.
- Keyboard-operable controls, arrow-key action tabs, modal focus handling, and reduced-motion styling.

## Scope of this first PR

This build has **no model calls, phone room joining, microphone voting, generated sprites, or production hosting**. The Dot is controlled by the game engine, and uploaded pets use player-selected abilities. Usage is fictional game health, not real OpenAI account credit. Google Fonts are optional visual enhancements; system font fallbacks are present.

The approved live-game expansion is recorded in [docs/LIVE_GAME.md](docs/LIVE_GAME.md). It follows this first reviewable prototype rather than being represented as already implemented.

## Code map

- `src/game.ts`: game types, room requirements, seeded randomness, and pure action handling.
- `src/game.test.ts`: legal and illegal moves, healing and trap limits, breeding, uploads, and endings.
- `src/App.tsx`: local party state, action controls, onboarding, upload dialog, and chronicle.
- `src/CastleMap.tsx`: illustrated interactive arena.
- `src/PetAvatar.tsx`: original starter pet illustrations and uploaded-image rendering.
- `src/styles.css`: desktop and mobile layouts, animation, and reduced-motion support.

Built with React, TypeScript, Vite, and Lucide icons. No app secrets belong in browser code or Git; `.env*` files are ignored.
