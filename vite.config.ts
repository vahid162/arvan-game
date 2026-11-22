import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const notice = 'THIRD-PARTY-NOTICES.txt';

export default defineConfig({
  build: {
    license: { fileName: notice },
  },
  plugins: [{
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
