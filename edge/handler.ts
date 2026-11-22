interface HandlerOptions {
  html: string;
  assets: Readonly<Record<string, string>>;
  origin: string;
  fetchAsset?: typeof fetch;
}

const text = 'text/plain; charset=utf-8';
const proxyHop = 'X-Light-Hunt-Asset-Hop';

export function validateAssetOrigin(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.href !== url.origin + '/') {
    throw new Error('Use an HTTPS asset origin without credentials, a path, or a query.');
  }
  return url;
}

function mimeType(value: string | null) {
  const type = value?.split(';', 1)[0]?.trim().toLowerCase();
  return type === 'application/javascript' ? 'text/javascript' : type;
}

export function createHandler({ html, assets, origin, fetchAsset = fetch }: HandlerOptions) {
  const assetOrigin = validateAssetOrigin(origin);
  const allowed = new Map(Object.entries(assets));

  return async (request: Request): Promise<Response> => {
    const head = request.method === 'HEAD';
    function reply(
      status: number,
      body: BodyInit | null,
      type = text,
      cache = 'no-store',
      headers: Record<string, string> = {},
    ) {
      return new Response(head ? null : body, {
        status,
        headers: {
          'Content-Type': type,
          'Cache-Control': cache,
          'X-Content-Type-Options': 'nosniff',
          'X-Light-Hunt-Edge': 'p02',
          ...headers,
        },
      });
    }

    if (!head && request.method !== 'GET') {
      return reply(405, 'Method not allowed\n', text, 'no-store', { Allow: 'GET, HEAD' });
    }

    const url = new URL(request.url);
    if (url.search) return reply(400, 'Query parameters are not supported\n');
    if (url.pathname === '/') return reply(200, html, 'text/html; charset=utf-8', 'no-cache');
    if (url.pathname === '/health') return reply(200, '{"status":"ok"}\n', 'application/json; charset=utf-8');

    const type = allowed.get(url.pathname);
    if (!type) return reply(404, 'Not found\n');
    if (url.hostname === assetOrigin.hostname || request.headers.has(proxyHop)) {
      return reply(502, 'Asset origin unavailable\n');
    }

    let upstream: Response;
    try {
      upstream = await fetchAsset(new URL(url.pathname, assetOrigin).href, {
        method: request.method,
        redirect: 'manual',
        headers: { [proxyHop]: '1' },
      });
    } catch {
      return reply(502, 'Asset origin unavailable\n');
    }

    if (upstream.redirected || upstream.status !== 200 ||
        mimeType(upstream.headers.get('Content-Type')) !== mimeType(type)) {
      void upstream.body?.cancel().catch(() => undefined);
      if (!upstream.redirected && upstream.status === 404) return reply(404, 'Not found\n');
      return reply(502, 'Asset origin unavailable\n');
    }

    const cache = url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    return reply(200, upstream.body, type, cache);
  };
}
