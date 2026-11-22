import { readFileSync } from 'node:fs';
import { defineConfig, type Connect } from 'vite';

const notice = 'THIRD-PARTY-NOTICES.txt';
const health: Connect.NextHandleFunction = (request, response, next) => {
  if (request.url !== '/health') return next();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : '{"status":"ok"}\n');
};

export default defineConfig({
  build: {
    license: { fileName: notice },
  },
  plugins: [{
    name: 'local-health',
    configureServer(server) { server.middlewares.use(health); },
    configurePreviewServer(server) { server.middlewares.use(health); },
  }, {
    name: 'vazirmatn-license',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const licenses = bundle[notice];
        if (licenses?.type !== 'asset') throw new Error('Missing bundled dependency licenses');
        const ofl = readFileSync(new URL('./src/assets/Vazirmatn-OFL.txt', import.meta.url), 'utf8');
        licenses.source = Buffer.from(licenses.source).toString('utf8') + '\n## Vazirmatn - 33.003 (OFL-1.1)\n\n' + ofl;
      },
    },
  }],
});
