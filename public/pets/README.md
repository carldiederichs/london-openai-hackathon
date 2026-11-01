# Codex pet sprite sheets

These are the original sprite sheets selected for the hackathon on 2026-11-01.
They are served locally; teammates do not need the desktop app or a local pets folder.

- Dewey, Fireball, Hoots, Rocky, Seedy, Stacky, BSOD, Null Signal and Codex were copied byte-for-byte from the installed ChatGPT/Codex app's bundled webview assets. Each is 1536 × 2288: eight columns, eleven rows, 192 × 208 pixels per cell.
- `tung-tung.webp` was copied byte-for-byte from `~/.codex/pets/0437-triple-t/spritesheet.webp`. Its game name is **Tung Tung**; the original local pet metadata is untouched. It is 1536 × 1872: eight columns, nine rows with the same cell size.
- `manifest.json` records dimensions by row count, file sizes and SHA-256 hashes of the imported originals.

The roster is in `src/pets.ts`. The default 3D guardians remain; `/practice` offers these sprites under More → Codex companions. Live players can choose a companion in the join form, which sends a grid-preserving resized sheet through the existing upload flow. Arbitrary uploads and description-only pets remain supported.

The castle plays row 0 at rest and rows 1/2 for screen-right/screen-left travel, using the original player's frame holds. The portraits use the same 6.6-second idle cadence. Idle has six occupied cells; directional running has eight. Row 7 is coding/work, not locomotion. Pause freezes practice animation, and reduced motion disables portrait animation and completes journeys immediately. Swimming, climbing and flying still use the running artwork along their existing world-space routes; these sheets have no dedicated swim/climb/flight rows.

These assets retain their original ownership; this project does not grant a separate license to the artwork.
