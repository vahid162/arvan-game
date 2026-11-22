import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'vite';
import { validateAssetOrigin } from './handler.ts';

const browser = new URL('../dist/', import.meta.url);
const output = new URL('../dist-edge/', import.meta.url);
const root = new URL('../', import.meta.url);
const origin = validateAssetOrigin(process.env.LIGHT_HUNT_ASSET_ORIGIN ?? 'https://p02-assets.test').origin;
const types = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', png: 'image/png', woff2: 'font/woff2' };
const notice = 'THIRD-PARTY-NOTICES.txt';
const assets = { ['/' + notice]: 'text/plain; charset=utf-8' };
const versionedPath = /^\/assets\/[\w-]+-[\w-]{8,}\.(js|css|png|woff2)$/;

for (const file of await readdir(browser)) {
  if (!['assets', 'index.html', notice].includes(file)) throw new Error('Unexpected browser output: ' + file);
}
for (const file of (await readdir(new URL('assets/', browser))).sort()) {
  const match = versionedPath.exec('/assets/' + file);
  if (!match) throw new Error('Unexpected browser artifact: ' + file);
  assets['/assets/' + file] = types[match[1]];
}
for (const requiredType of Object.values(types)) {
  if (!Object.values(assets).includes(requiredType)) throw new Error('Browser build missing ' + requiredType);
}

const html = await readFile(new URL('index.html', browser), 'utf8');
const entryHtmlSha256 = hash(html);
const assetHashes = {};
for (const [path, contentType] of Object.entries(assets)) {
  const bytes = await readFile(new URL(path.slice(1), browser));
  assetHashes[path] = { contentType, sha256: hash(bytes), bytes: bytes.length };
}

// Retain old immutable URLs for clients that opened the previous entry before the switch.
const retainedAssets = {};
const retainedBytes = new Map();
const previous = process.env.LIGHT_HUNT_RETAINED_RELEASE;
if (previous) {
  const archive = pathToFileURL(resolve(previous) + '/');
  const manifest = JSON.parse(await readFile(new URL('dist-edge/manifest.json', archive), 'utf8'));
  if (manifest.origin !== origin) throw new Error('Retained release used a different asset origin');
  for (const [location, files] of [['dist', manifest.assets], ['dist-edge/retained', manifest.retainedAssets ?? {}]]) {
    for (const path of Object.keys(files).sort()) {
      if (path === '/' + notice && location === 'dist') continue;
      const match = versionedPath.exec(path);
      const item = files[path];
      if (!match || item.contentType !== types[match[1]]) throw new Error('Invalid retained asset: ' + path);
      const existing = assetHashes[path] ?? retainedAssets[path];
      if (existing) {
        if (existing.sha256 !== item.sha256 || existing.bytes !== item.bytes) throw new Error('Immutable URL collision: ' + path);
        continue;
      }
      const bytes = await readFile(new URL(location + path, archive));
      if (hash(bytes) !== item.sha256 || bytes.length !== item.bytes) throw new Error('Retained asset digest mismatch: ' + path);
      retainedAssets[path] = { contentType: types[match[1]], sha256: item.sha256, bytes: bytes.length };
      retainedBytes.set(path, bytes);
    }
  }
}
const allowed = { ...assets };
for (const [path, item] of Object.entries(retainedAssets)) allowed[path] = item.contentType;

await build({
  configFile: false,
  publicDir: false,
  define: {
    ENTRY_HTML: JSON.stringify(html),
    ASSETS: JSON.stringify(allowed),
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
if (retainedBytes.size) {
  await mkdir(new URL('retained/assets/', output), { recursive: true });
  for (const [path, bytes] of retainedBytes) await writeFile(new URL('retained' + path, output), bytes);
}
const sourceInputs = ['.nvmrc', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.tests.json', 'vite.config.ts',
  'index.html', 'edge/build.mjs', 'edge/handler.ts', 'edge/entry.ts', ...await sourceFiles('src/')].sort();
const inputHashes = await Promise.all(sourceInputs.map(async path => [path, hash(await readFile(new URL(path, root)))]));
const browserFiles = { ...assetHashes, '/index.html': { sha256: entryHtmlSha256 } };
const browserSha256 = hash(JSON.stringify(Object.keys(browserFiles).sort().map(path => [path, browserFiles[path].sha256])));
const manifest = {
  source: { ...await gitIdentity(), buildInputsSha256: hash(JSON.stringify(inputHashes)), lockfileSha256: Object.fromEntries(inputHashes)['package-lock.json'] },
  nodeVersion: process.version, origin, browserSha256, entryHtmlSha256, assets: assetHashes, retainedAssets, workerSha256: hash(worker),
};
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');

async function sourceFiles(prefix) {
  const files = [];
  for (const entry of await readdir(new URL(prefix, root), { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...await sourceFiles(prefix + entry.name + '/'));
    else if (entry.isFile()) files.push(prefix + entry.name);
    else throw new Error('Unsupported source file: ' + prefix + entry.name);
  }
  return files;
}

async function gitIdentity() {
  const git = async (...args) => (await promisify(execFile)('git', args, { cwd: root })).stdout.trim();
  try {
    if (resolve(await git('rev-parse', '--show-toplevel')) === resolve(fileURLToPath(root))) {
      return { revision: await git('rev-parse', 'HEAD'), dirty: Boolean(await git('status', '--porcelain', '--untracked-files=normal')) };
    }
  } catch {
    // Source archives can still be verified using the actual input digest.
  }
  return { revision: null, dirty: null };
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
