# Visible pet movement

Integrates Max's draft [PR #2](https://github.com/carldiederichs/london-openai-hackathon/pull/2), extended to the single-floor castle and larger gardens.

## Try it

Open `/practice`. **Send the pack** sends ten guardians to different legal habitats. Select a guardian and click a light ring, or search **Choose a destination**. **Follow pet** follows the selected guardian; **Reset view** returns to the estate overview. **Pause** freezes travel and gait. **Loop tour** waits for everyone to arrive before sending the next group. **Todd, run!** moves the visible rehearsal hider. Practice stays in this tab and makes no model calls.

Upload an ordinary image or a Codex atlas (1536 × 1872 or 1536 × 2288). Practice retains the guardian's existing abilities. Artwork changes are disabled during that guardian's journey. Back to base camp restores the practice roster and starts return journeys.

## How movement fits the world

`world.ts` supplies shared room, marker and route coordinates: 42 hiding places, including 26 interior rooms, plus camp and care destinations. All playable interiors occupy one floor. The exterior's towers and upper windows are decoration, with no floor switching. The central fountain court has routes around its fountain, and relocated front rooms have matching rear doors. Garden geometry, destinations and waypoints share the same enlargement transform.

`movement.ts` finds routes through the entrance, door gaps, galleries and garden paths. Corners are rounded. Journeys retain their current position when redirected, and use elapsed time, acceleration, braking and each card's speed. Flight rises above the tallest keep. Swimming and climbing modes animate along authored routes.

Original guardians remain distinct 3D animals: jointed legs, distance-driven strides, wingbeats, body sway and smooth heading changes. Uploaded images use moving billboards. Atlases use idle row 0 and directional running rows 1–2, with isolated UV cells. Route traces and names identify moving pets without permanently labelling every guardian.

The cutaway opens for occupied interior destinations. Vet and breeding effects begin after arrival, so a long trip does not consume the care animation. Newborns remain concealed during the nursery sequence. The host's Next round button waits for its local journeys. Live Todd positions are still filtered by the server; practice deliberately shows Todd.

Reduced motion skips journeys and gait. Hidden tabs pause rendering instead of accumulating a large catch-up step. Static geometry is batched; route planning is cached and does not run every frame. This is authored waypoint movement, not a physics simulation: pets do not avoid one another, and new furniture or room layouts must keep the authored paths clear.

## Verification

The final suite has 25 passing tests: all destination pairs, exact arrivals, retarget continuity, refresh-rate-independent sampling, fountain clearance, front-room door access, flight clearance, sprite frames, sprite metadata and server rules. TypeScript and production build pass.

Browser checks observed ten simultaneous visible departures, follow-camera movement, unchanged actor positions while paused, and the furnished cutaway. A separate live host and seeker submitted a search for the distant Banquet of Tokens; the host disabled Next round during travel and the seeker arrived with 90 usage. A 390-pixel seeker view had no horizontal overflow. These checks used offline rules; no actual model calls, microphone hardware or physical phone networking were tested in this integration.
