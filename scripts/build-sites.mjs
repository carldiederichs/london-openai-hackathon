import { build } from "esbuild";
import {
  readFile,
  readdir,
  mkdir,
  copyFile,
  writeFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const assets = {},
  root = process.cwd(),
  client = path.join(root, "dist/client");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/plain",
};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
      continue;
    }
    const route = "/" + path.relative(client, file).split(path.sep).join("/");
    let bytes = await readFile(file),
      mime = types[path.extname(file)];
    if (!mime) continue;
    // Keep every frame and row of the original Max atlases. Pixel-art cells are
    // 96px at this scale, above their on-screen size; source originals stay in Git.
    if (route.startsWith("/pets/") && route.endsWith(".webp"))
      bytes = await sharp(bytes)
        .resize({ width: 768, kernel: "nearest", withoutEnlargement: true })
        .webp({ quality: 82, alphaQuality: 100 })
        .toBuffer();
    else if (route === "/ancestors-atlas.png" || route === "/tibo-pixel.png") {
      bytes = await sharp(bytes)
        .resize({
          width: route.includes("ancestors") ? 1024 : 384,
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      mime = "image/webp";
    }
    assets[route] = { mime, base64: bytes.toString("base64") };
  }
}
await walk(client);
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["sites/worker.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  plugins: [
    {
      name: "site-assets",
      setup(b) {
        b.onResolve({ filter: /^site-assets$/ }, () => ({
          path: "site-assets",
          namespace: "assets",
        }));
        b.onLoad({ filter: /.*/, namespace: "assets" }, () => ({
          contents: `export default ${JSON.stringify(assets)}`,
          loader: "js",
        }));
      },
    },
  ],
});
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
console.log(
  `Embedded ${Object.keys(assets).length} assets, all ten complete pet atlases; Worker ${(await readFile("dist/server/index.js")).length} bytes.`,
);

// The Worker embeds its client assets. Do not upload duplicate Vite output or
// stale files from an earlier static deployment.
for (const name of await readdir("dist")) {
  if (!["server", ".openai"].includes(name))
    await rm(path.join("dist", name), { recursive: true, force: true });
}
