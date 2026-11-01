import { build } from "esbuild";
import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const clientDirectory = path.join(root, "dist/client");
const serverDirectory = path.join(root, "dist/server");
const assets = Object.create(null);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
let embeddedBytes = 0;

async function addAsset(file, route) {
  const bytes = await readFile(file);
  const extension = path.extname(file).toLowerCase();
  const mime = mimeTypes[extension];
  if (!mime) throw new Error(`Unsupported embedded asset type: ${file}`);
  assets[route] = { mime, base64: bytes.toString("base64") };
  embeddedBytes += bytes.length;
}

async function addClientAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await addClientAssets(file);
    else if (entry.isFile() && /\.(?:js|css)$/i.test(entry.name)) {
      const route = `/${path.relative(clientDirectory, file).split(path.sep).join("/")}`;
      await addAsset(file, route);
    }
  }
}

await addAsset(path.join(clientDirectory, "index.html"), "/index.html");
await addClientAssets(path.join(clientDirectory, "assets"));
for (const name of ["ancestors-atlas.png", "tibo-pixel.png"]) {
  await addAsset(path.join(root, "public", name), `/${name}`);
}
const sampleDirectory = path.join(root, "public/pets/samples");
const samples = (await readdir(sampleDirectory))
  .filter((name) => name.toLowerCase().endsWith(".png"))
  .sort();
if (!samples.length) throw new Error("No sample pet PNGs found.");
for (const name of samples) {
  await addAsset(path.join(sampleDirectory, name), `/pets/samples/${name}`);
}
// These small SVGs are referenced by index.html and the castle scene.
for (const name of ["favicon.svg", "openai-knot.svg"]) {
  const file = path.join(root, "public", name);
  if (await stat(file).then((entry) => entry.isFile(), () => false)) {
    await addAsset(file, `/${name}`);
  }
}

await mkdir(serverDirectory, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, "sites/worker.ts")],
  outfile: path.join(serverDirectory, "index.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: false,
  metafile: true,
  logLevel: "info",
  plugins: [{
    name: "embedded-site-assets",
    setup(context) {
      context.onResolve({ filter: /^site-assets$/ }, () => ({
        path: "site-assets",
        namespace: "embedded-site-assets",
      }));
      context.onLoad({ filter: /.*/, namespace: "embedded-site-assets" }, () => ({
        contents: `const assets = ${JSON.stringify(assets)}; export { assets }; export default assets;`,
        loader: "js",
      }));
    },
  }],
});
const externalImports = Object.values(result.metafile.outputs)
  .flatMap((output) => output.imports)
  .filter((entry) => entry.external);
if (externalImports.length) {
  throw new Error(`Worker bundle has external dependencies: ${externalImports.map((entry) => entry.path).join(", ")}`);
}
await mkdir(path.join(root, "dist/.openai"), { recursive: true });
await copyFile(path.join(root, ".openai/hosting.json"), path.join(root, "dist/.openai/hosting.json"));
console.log(`Embedded ${Object.keys(assets).length} assets (${embeddedBytes.toLocaleString("en-US")} source bytes); excluded full pet WebP atlases.`);
console.log("Sites Worker ready: dist/server/index.js");
