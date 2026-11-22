import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../edge/handler';

const site = 'https://play.example.test';
const origin = 'https://assets.example.test';
const script = '/assets/shell-19fcfa07.js';
const stylesheet = '/assets/styles-47c281de.css';
const texture = '/assets/firefly-8ac4d102.png';
const notices = '/THIRD-PARTY-NOTICES.txt';
const html = `<!doctype html><title>Light Hunt</title><script type="module" src="${script}"></script>`;
const assets = {
  [script]: 'text/javascript; charset=utf-8',
  [stylesheet]: 'text/css; charset=utf-8',
  [texture]: 'image/png',
  [notices]: 'text/plain; charset=utf-8',
};

// Every upstream operation is injected. Even an unexpected fetch stays in this fixture.
function fixture(upstream?: typeof fetch, assetOrigin = origin) {
  const fetchAsset = vi.fn<typeof fetch>(upstream ?? (async () => {
    throw new Error('Unexpected request to the asset service');
  }));
  const handle = createHandler({ html, assets, origin: assetOrigin, fetchAsset });
  return { handle, fetchAsset };
}

function request(path: string, method = 'GET', headers?: HeadersInit) {
  return new Request(site + path, { method, headers });
}

function cacheDirectives(response: Response) {
  return response.headers.get('cache-control')?.toLowerCase().split(',').map(value => value.trim());
}

describe('Edge entry and health', () => {
  it.each(['/', '/health'])('serves %s locally with equivalent GET and HEAD headers', async path => {
    const { handle, fetchAsset } = fixture();
    const get = await handle(request(path));
    expect(get.status).toBe(200);
    expect(cacheDirectives(get)).toContain(path === '/' ? 'no-cache' : 'no-store');
    const body = await get.text();
    if (path === '/') {
      expect(get.headers.get('content-type')).toMatch(/^text\/html\b/i);
      expect(body).toBe(html);
    } else {
      expect(body.trim().length).toBeGreaterThan(0);
      expect(body.length).toBeLessThan(256);
    }

    const head = await handle(request(path, 'HEAD'));
    expect(head.status).toBe(get.status);
    expect(head.headers.get('content-type')).toBe(get.headers.get('content-type'));
    expect(head.headers.get('cache-control')).toBe(get.headers.get('cache-control'));
    expect(head.body).toBeNull();
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'OPTIONS'])('rejects %s and advertises the supported methods', async method => {
    const { handle, fetchAsset } = fixture();
    const response = await handle(request(script, method));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')?.split(',').map(value => value.trim()).sort()).toEqual(['GET', 'HEAD']);
    expect(cacheDirectives(response)).toContain('no-store');
    expect(fetchAsset).not.toHaveBeenCalled();
  });
});

describe('assets from the release manifest', () => {
  it('fetches only the configured origin and sends the browser the expected JavaScript MIME type', async () => {
    const body = 'export const scene = "forest";';
    const { handle, fetchAsset } = fixture(async () => new Response(body, { headers: {
      'Content-Type': 'Application/JavaScript; charset=UTF-8',
      'Set-Cookie': 'example=upstream',
      'Cache-Control': 'no-store',
    } }));
    const response = await handle(request(script, 'GET', { Cookie: 'example=visitor', 'X-Player-Mode': 'practice' }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
    expect(response.headers.get('content-type')).toBe(assets[script]);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(cacheDirectives(response)).toEqual(expect.arrayContaining(['public', 'max-age=31536000', 'immutable']));
    expect(fetchAsset).toHaveBeenCalledTimes(1);
    const sent = new Request(...fetchAsset.mock.calls[0]!);
    expect(sent.url).toBe(origin + script);
    expect(sent.method).toBe('GET');
    expect(sent.redirect).toBe('manual');
    expect(sent.headers.has('cookie')).toBe(false);
    expect(sent.headers.has('x-player-mode')).toBe(false);
  });

  it('serves production stylesheets with a CSS MIME type', async () => {
    const css = 'body { color: wheat; }';
    const { handle } = fixture(async () => new Response(css, { headers: { 'Content-Type': 'text/css' } }));
    const result = await handle(request(stylesheet));
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe(assets[stylesheet]);
    expect(cacheDirectives(result)).toContain('immutable');
    expect(await result.text()).toBe(css);
  });

  it('preserves texture bytes and uses HEAD upstream for a metadata-only request', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const { handle, fetchAsset } = fixture(async (input, init) => {
      const sent = new Request(input, init);
      return new Response(sent.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': 'IMAGE/PNG' } });
    });
    const get = await handle(request(texture));
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(cacheDirectives(get)).toContain('immutable');
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);

    const head = await handle(request(texture, 'HEAD'));
    expect(head.status).toBe(200);
    expect(head.headers.get('content-type')).toBe(get.headers.get('content-type'));
    expect(head.headers.get('cache-control')).toBe(get.headers.get('cache-control'));
    expect(head.body).toBeNull();
    expect(fetchAsset).toHaveBeenCalledTimes(2);
    const sent = new Request(...fetchAsset.mock.calls[1]!);
    expect(sent.url).toBe(origin + texture);
    expect(sent.method).toBe('HEAD');
    expect(sent.redirect).toBe('manual');
  });

  it('revalidates third-party notices at their stable URL', async () => {
    const { handle } = fixture(async () => new Response('Example notices', { headers: { 'Content-Type': 'text/plain' } }));
    const result = await handle(request(notices));
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('Example notices');
    expect(result.headers.get('content-type')).toBe(assets[notices]);
    expect(cacheDirectives(result)).toContain('no-cache');
    expect(cacheDirectives(result)).not.toContain('immutable');
  });
});

describe('route and origin boundaries', () => {
  it.each([
    ['/assets/unknown-2bb3c377.js', 404],
    ['/unpublished.html', 404],
    [script + '?origin=https://alternate.example.test', 400],
    ['/?preview=yes', 400],
    ['/health?format=html', 400],
  ] as const)('rejects %s without contacting storage', async (path, status) => {
    const { handle, fetchAsset } = fixture();
    for (const method of ['GET', 'HEAD']) {
      const result = await handle(request(path, method));
      expect(result.status).toBe(status);
      expect(cacheDirectives(result)).toContain('no-store');
      if (method === 'HEAD') expect(result.body).toBeNull();
    }
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it.each(['', 'http://assets.example.test', origin + '/collection', origin + '?bucket=demo',
    origin + '#collection', 'https://example-user@assets.example.test'])('rejects invalid configured origin %j', value => {
    expect(() => fixture(undefined, value)).toThrow();
  });

  it.each([site, site + ':8443'])('rejects an asset origin sharing the entry hostname (%s)', async value => {
    const { handle, fetchAsset } = fixture(undefined, value);
    const result = await handle(request(texture));
    expect(result.status).toBe(502);
    expect(cacheDirectives(result)).toContain('no-store');
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it('stops a storage hostname routed back to the same Edge function under a different name', async () => {
    const { handle, fetchAsset } = fixture();
    fetchAsset.mockImplementationOnce(async (input, init) => {
      const outbound = new Request(input, init);
      const alias = new URL(outbound.url);
      alias.hostname = 'alternate-play.example.test';
      return handle(new Request(alias, { headers: outbound.headers, method: outbound.method }));
    });
    const result = await handle(request(script));
    expect(result.status).toBe(502);
    expect(cacheDirectives(result)).toContain('no-store');
    expect(fetchAsset).toHaveBeenCalledTimes(1);
  });
});

describe('storage failures', () => {
  it.each([
    { name: 'missing', upstream: 404, expected: 404 },
    { name: 'redirect', upstream: 302, expected: 502 },
    { name: 'partial content', upstream: 206, expected: 502 },
    { name: 'outage', upstream: 503, expected: 502 },
    { name: 'wrong content type', upstream: 200, expected: 502 },
  ])('turns a $name response into a local $expected', async ({ upstream, expected }) => {
    const { handle, fetchAsset } = fixture(async () => new Response('Storage diagnostics', {
      status: upstream, headers: {
        'Content-Type': 'text/html', 'Location': 'https://alternate.example.test/', 'Cache-Control': 'max-age=3600',
      },
    }));
    for (const method of ['GET', 'HEAD']) {
      const result = await handle(request(script, method));
      expect(result.status).toBe(expected);
      expect(cacheDirectives(result)).toContain('no-store');
      expect(result.headers.has('location')).toBe(false);
      if (method === 'HEAD') expect(result.body).toBeNull();
      expect(await result.text()).not.toContain('Storage diagnostics');
    }
    expect(fetchAsset).toHaveBeenCalledTimes(2);
  });

  it('returns a recoverable response on a transport exception and retries a later request', async () => {
    const { handle, fetchAsset } = fixture();
    fetchAsset.mockRejectedValueOnce(new Error('Storage fixture offline'))
      .mockResolvedValueOnce(new Response('export {}', { headers: { 'Content-Type': 'text/javascript' } }));
    const failed = await handle(request(script));
    expect(failed.status).toBe(502);
    expect(cacheDirectives(failed)).toContain('no-store');
    expect(await failed.text()).not.toContain('Storage fixture offline');
    const recovered = await handle(request(script));
    expect(recovered.status).toBe(200);
    expect(await recovered.text()).toBe('export {}');
    expect(fetchAsset).toHaveBeenCalledTimes(2);
  });
});
