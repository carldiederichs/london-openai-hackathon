# One shared castle

`/` is the big screen; `/join` is the phone chooser and arrow controller. Guests join anonymously. All controllers and screens connect to one authoritative world. The server validates session ownership and movement, clamps map bounds, blocks walking through the main mansion, normalizes diagonals and stops input after two seconds without a refresh. Releasing a button, backgrounding the page or disconnecting also stops movement. Refresh restores the pet; choosing another pet removes the previous one. Disconnected pets retain their slot for three minutes.

Five sample portraits come from existing ChatGPT built-in pets. Own pets use an image upload or the first idle frame of an exported ChatGPT pet atlas. No private account library connection is required.

## ChatGPT Sites + Cloudflare Durable Objects

The frontend can be built as static `dist` and hosted as a public ChatGPT Site. The live backend must run separately: Sites static hosting does not run this Node server. `worker/index.js` and `wrangler.jsonc` provide the Cloudflare backend. Every request routes to the same named Durable Object, `promptkeep-castle`, with capacity 300. Native WebSockets send movement to that object; the big screen gets all pets, while each phone gets its own pet plus counts. Movement ticks at 20 Hz with updates at up to 10 Hz. Sessions and positions are saved to Durable Object storage, with movement checkpointed every two seconds; a restart may lose the last two seconds of movement. Uploaded portraits use separate storage values.

Deployment steps:

1. Authenticate Wrangler to the intended Cloudflare account and run `npx wrangler deploy` from this repository.
2. Set `ALLOWED_ORIGINS` on the Worker to the final Site origin (comma separated if multiple origins are required).
3. Set `VITE_WORLD_API_URL` to the Worker HTTPS URL before `npm run build`.
4. Publish `dist` using Sites, with public access for signed-out guests. The QR code uses that Site origin.
5. Test actual phones on venue internet and load-test the deployed Worker. The local Node path now tests 300 live WebSocket controllers moving and stopping together; this does not establish physical-device, rendering or deployed performance.

This source has not yet been deployed to either host. The Node/Socket.IO path is verified locally; the Worker still needs a Cloudflare runtime check and deployment credentials. No ChatGPT, OpenAI API, or pet account key is exposed to guests.
