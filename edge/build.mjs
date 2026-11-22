import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { validateAssetOrigin } from './handler.ts';

const browser = new URL('../dist/', import.meta.url);
const output = new URL('../dist-edge/', import.meta.url);
const origin = validateAssetOrigin(process.env.LIGHT_HUNT_ASSET_ORIGIN ?? 'https://p02-assets.test').origin;
const types = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', png: 'image/png' };
const notice = 'THIRD-PARTY-NOTICES.txt';
const assets = { ['/' + notice]: 'text/plain; charset=utf-8' };

for (const file of (await readdir(new URL('assets/', browser))).sort()) {
  const match = /^[\w-]+-[\w-]{8,}\.(js|css|png)$/.exec(file);
  if (!match) throw new Error('Unexpected browser artifact: ' + file);
  assets['/assets/' + file] = types[match[1]];
}
for (const requiredType of Object.values(types)) {
  if (!Object.values(assets).includes(requiredType)) throw new Error('Browser build missing ' + requiredType);
}

const html = await readFile(new URL('index.html', browser), 'utf8');
const assetHashes = {};
for (const [path, contentType] of Object.entries(assets)) {
  const bytes = await readFile(new URL(path.slice(1), browser));
  assetHashes[path] = { contentType, sha256: hash(bytes), bytes: bytes.length };
}

await build({
  configFile: false,
  publicDir: false,
  define: {
    ENTRY_HTML: JSON.stringify(html),
    ASSETS: JSON.stringify(assets),
    ASSET_ORIGIN: JSON.stringify(origin),
  },
  build: {
    outDir: fileURLToPath(output),
    emptyOutDir: true,
    target: 'es2022',
    lib: {
      entry: fileURLToPath(new URL('./entry.ts', import.meta.url)),
      name: 'LightHuntEdge',
      formats: ['iife'],
      fileName: () => 'worker.js',
    },
  },
});

const worker = await readFile(new URL('worker.js', output));
const manifest = { origin, entryHtmlSha256: hash(html), assets: assetHashes, workerSha256: hash(worker) };
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
