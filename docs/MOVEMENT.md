# Visible pet movement

This branch builds on main at `003bd44`. The aim is readable journeys on the shared castle screen, starting with pets whose artwork already exists.

## Try it

Run `npm run dev`, then open `/practice`. Click **Send the pack** to send ten guardians along different legal routes. Select a guardian and click a castle marker (or open **Choose a destination**) to direct it. Locked rooms retain the shared ability rules. Upload an ordinary image or supported Codex atlas to replace that guardian's artwork locally. No model calls or phone sessions are needed in practice.

**Todd, run!** moves the separate dark hider between rooms. It is deliberately visible in practice so its movement can be rehearsed. **Loop tour** sends the pack every 16 seconds, with **Pause** stopping travel and animation. **Back to base camp** clears practice artwork and resets the scene.

In a live room, player submissions and the authoritative server still decide destinations. The scene animates the resulting location changes. Todd is shown in the lobby and at the existing public round reveal, without sending hidden positions to any client.

## Movement model

- Ground journeys use a small waypoint graph covering the grounds, terrace steps, entrance, corridor and interior door gaps. A new order during travel retains the actor's current position.
- A trip stores its route, distance, duration and elapsed time. Sampling by elapsed time avoids frame-dependent position blending. Speed changes duration; easing provides acceleration and braking. Flights take off, cross above the castle and land.
- Pet artwork is a camera-facing sprite at a world-space position. Original illustrated avatars replace the earlier low-detail spheres. Uploaded atlases use row 0 for idle, row 1 for running right and row 2 for running left, with direction measured relative to the camera. Row 7 is task work and is not a locomotion animation.
- Name tags, selection rings and colored route lines identify travelling pets. Interior cutaways stay open while pets arrive or leave. Live next-round controls wait for the local animation; the server's game rules are unchanged.
- Reduced motion moves directly to the destination and stops gait/atlas playback. Practice pause freezes elapsed travel time and sprite animation. Hidden tabs do not accumulate a large catch-up step.

This is waypoint locomotion, with ability rules supplied by the game. It does not add a rigid-body solver, pet-to-pet collision avoidance, independent floor geometry or combat. Swimming and climbing use authored access routes; their dedicated limb animations are not part of the Codex atlas contract. The existing cutaway presents tower/interior rooms on the accessible lower floor.

## Verification on 2026-11-01

- Automated checks cover ground routes through the entrance, finite routes and exact arrivals for all location pairs, flight altitude, speed-based duration, directional atlas UVs and retained sprite metadata in public room state.
- Browser practice: ten simultaneous departures and arrivals, visible independent Todd movement, local atlas import using a synthetic colored-cell fixture, a single room command, pause, and narrow-screen controls. Reduced-motion emulation produced immediate arrivals with no moving actors.
- Live browser: separate host and seeker tabs created an AI owl card, started a hunt, submitted a flight to the Cloud Rookery, and resolved it. The host showed a travelling guardian and disabled next-round advancement during the flight. Todd appeared in the public reveal.
- A separate real HTTP/Socket.IO check used the supplied local API configuration for a card, hiding choice and camp-to-garden move, with zero fallback decisions. No credentials are included in these notes.

The synthetic atlas verifies importing and cell selection. Motion quality of an audience member's particular Codex sprite sheet still depends on the supplied artwork. The current ten preview guardians use existing illustrated static art with travel/gait motion. Physical-phone networking and microphone hardware remain separate venue checks.
