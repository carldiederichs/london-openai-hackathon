# Promptkeep prototype

Build a browser-local castle hide-and-seek game for the London OpenAI hackathon.

## Rules for the first playable version

- Ten guardians, three rounds, one action per pet per round.
- Find the Dot three times to capture it. It flees after a sighting and at round end.
- Move and search a location for 10 usage. Traits determine access.
- Hidden bottle traps cost 25 usage. A hidden, single-use Tivo button refills its finder.
- The vet restores 50 usage, capped at 100, and remains available at zero usage.
- Breeding costs both parents 20 usage and their actions. The baby inherits their traits
  and can act next round. A party can contain at most 16 pets.
- Uploads are local images with player-chosen traits. No AI inference, real account
  usage changes, online multiplayer, or microphone voting in this prototype.

## Work and verification

- [x] Inspect the remote, clone an isolated checkout, and define the game rules.
- [x] Implement the deterministic game engine and exercise rule boundaries.
- [x] Build the illustrated castle, pet roster, action panel, uploads, and instructions.
- [x] Run tests and production build. Play through the game in a browser and check mobile layout.
- [x] Push the branch, open a PR, and save the verified handoff. PR #1 is open and ready for review; shared-memory save was read back.

## Follow-up scope

The user approved live phone joining, AI moves, and cheering, then prioritized making this first PR ready. The live expansion is tracked in `docs/LIVE_GAME.md` and is not included in this prototype.
