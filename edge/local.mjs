import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { runInNewContext } from 'node:vm';

// Execute the built adapter with only web APIs. The origin fixture serves the
// same browser assets over loopback so this preview can run without an account.
const browser = new URL('../dist/', import.meta.url);
const output = new URL('../dist-edge/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8'));

async function readArtifact(file, expectedHash) {
  const bytes = await readFile(file);
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
    throw new Error('Artifact differs from the Edge manifest: ' + file.pathname);
  }
  return bytes;
}

const worker = await readArtifact(new URL('worker.js', output), manifest.workerSha256);
await readArtifact(new URL('index.html', browser), manifest.entryHtmlSha256);
const assets = new Map();
for (const [directory, files] of [[browser, manifest.assets], [new URL('retained/', output), manifest.retainedAssets ?? {}]]) {
  for (const [path, { contentType, sha256 }] of Object.entries(files)) {
    assets.set(path, { contentType, bytes: await readArtifact(new URL(path.slice(1), directory), sha256) });
  }
}

const origin = createServer((request, response) => {
  const asset = assets.get(request.url);
  if (!asset) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': asset.contentType }).end(request.method === 'HEAD' ? undefined : asset.bytes);
});

let receive;
runInNewContext(worker.toString('utf8'), {
  URL, Request, Response, Headers,
  addEventListener(type, listener) {
    if (type !== 'fetch' || receive) throw new Error('Expected exactly one Edge fetch listener.');
    receive = listener;
  },
  fetch(url, options) {
    const upstream = new URL(url);
    if (upstream.origin !== manifest.origin) throw new Error('Unexpected fixture origin.');
    return fetch('http://127.0.0.1:' + origin.address().port + upstream.pathname, options);
  },
}, { filename: 'worker.js' });
if (!receive) throw new Error('Edge fetch listener is missing.');

const port = Number(process.argv[2] ?? 4174);
const edge = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'http://127.0.0.1:' + port);
    const method = incoming.method;
    const request = method === 'GET' || method === 'HEAD'
      ? new Request(url, { method, headers: incoming.headers })
      : { url: url.href, method };
    const response = await new Promise((resolve, reject) => receive({
      request, respondWith: result => result.then(resolve, reject),
    }));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const stream = Readable.fromWeb(response.body);
      stream.on('error', error => outgoing.destroy(error));
      stream.pipe(outgoing);
      outgoing.on('close', () => stream.destroy());
    } else {
      outgoing.end();
    }
  } catch (error) {
    if (outgoing.headersSent) outgoing.destroy(error);
    else outgoing.writeHead(500, { 'Cache-Control': 'no-store' }).end('Local preview failed\n');
  }
});

origin.listen(0, '127.0.0.1');
await once(origin, 'listening');
edge.on('error', () => origin.close());
edge.listen(port, '127.0.0.1');
await once(edge, 'listening');
console.log('Local Edge preview at http://127.0.0.1:' + edge.address().port);
