# Sites-only shared castle

The production game is hosted entirely by ChatGPT Sites: a Worker ESM application serves the castle, phone interface and same-origin HTTP game API. Sites provisions the DB binding and applies the generated Drizzle migrations. No personal Cloudflare account, API token, or separate backend is used.

`/` shows the castle and QR code; `/join` lets anonymous guests choose one of five existing pets, upload an image or import the first idle cell of an exported ChatGPT pet sheet, and hold arrows to move.

The shared database stores session ownership and authoritative input/positions. A conditional insert atomically enforces 300 slots under concurrent joins. Input sequence checks reject stale or repeated packets. Movement is projected from the last saved position and direction, with map bounds, mansion collision and a two-second input timeout. Releasing an arrow sends a stop request. A browser crash can leave a pet moving for at most two seconds; disconnected slots expire after three minutes.

The hosted transport uses HTTP rather than the LAN prototype’s Socket.IO: the big screen refreshes every 200 ms plus request time; a phone refreshes its own state every 750 ms plus request time. Each phone receives only its own pet and crowd counts. Pet images are loaded separately from position records. This first Sites-only deployment needs real device and live 300-player performance testing; local SQL admission tests and the separate Node WebSocket crowd test do not establish hosted throughput.

Build: `npm run build`. This creates the Sites Worker and embedded frontend assets. `npm run build:local` retains the original local Node build. `npm run dev` continues to run the LAN prototype. The hosted release contains the shared world; the older Node hunt API is not part of this Worker.

The earlier `worker/index.js` / `wrangler.jsonc` Durable Object implementation is retained as unused prototype source. It is not part of the Sites deployment.
