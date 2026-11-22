import { createHandler } from './handler';

declare const ENTRY_HTML: string;
declare const ASSETS: Record<string, string>;
declare const ASSET_ORIGIN: string;

interface EdgeFetchEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

declare function addEventListener(type: 'fetch', listener: (event: EdgeFetchEvent) => void): void;

const handle = createHandler({ html: ENTRY_HTML, assets: ASSETS, origin: ASSET_ORIGIN });
addEventListener('fetch', event => event.respondWith(handle(event.request)));
