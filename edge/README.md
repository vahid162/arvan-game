# Edge delivery

## Local verification

From the repository root, run `npm run test:edge` for the route contract and `npm run test:browser:edge` to exercise the generated Edge handler in Chromium. The browser command builds the artifacts and uses port 4174. [Browser setup](../README.md#build-and-verify)

For a manual session, run `npm run build:edge`, then `npm run preview:edge`. Open `http://127.0.0.1:4174/`. The Node harness loads the bundled script and sends asset requests to a separate loopback HTTP server. This works with the reserved local build origin `https://p02-assets.test` and requires no network account.

| Path | Expected GET and HEAD result |
| --- | --- |
| `/` | 200 HTML, `Cache-Control: no-cache` |
| `/health` | 200 JSON, `Cache-Control: no-store`, Edge marker `X-Light-Hunt-Edge: p02` |
| Exact versioned paths listed in `dist-edge/manifest.json` | 200 with the listed content type and `Cache-Control: public, max-age=31536000, immutable` |
| `/THIRD-PARTY-NOTICES.txt` | 200 text, `Cache-Control: no-cache` |
| Unknown path | 404 with `Cache-Control: no-store` |

HEAD returns the matching status and headers with an empty body. Other methods return 405 with `Allow: GET, HEAD`. Query parameters return 400. The handler returns 502 for an unreachable origin, a redirect, an unexpected upstream status other than 404, or a MIME mismatch.

## Staging probe after approval

The approved target needs a named ArvanCloud account and Edge app, the app's default `arvanedge.ir` test URL or a dedicated staging hostname, and a separate HTTPS Storage/CDN origin. The operator needs permissions to upload the listed objects and publish the Edge function. A custom hostname also needs permission to bind an existing Arvan CDN route. ArvanCloud assigns the default domain, accepts prebuilt scripts in the panel, and records each deployment ID. A custom route creates a CDN page rule. [Edge dashboard](https://docs.arvancloud.ir/fa/edge-computing/dashboard/) · [Routing](https://docs.arvancloud.ir/fa/edge-computing/trigger/path/) · [Storage website](https://docs.arvancloud.ir/fa/object-storage/buckets/static-website/)

Before any upload, confirm the account's actual request and traffic quotas, bundle limit, storage and egress costs, and the approved spending ceiling. The public PAYG schedule meters outgoing traffic and shares its request allowance across the account. Keep any operator credentials in the provider or approved credential store. The HTTPS origin is public build configuration. [ArvanCloud pricing](https://www.arvancloud.ir/fa/pricing/edge-computing) · [Environment values](https://docs.arvancloud.ir/fa/edge-computing/env-variables/)

1. Set `LIGHT_HUNT_ASSET_ORIGIN` to the approved HTTPS origin and run `npm run build:edge`. Record the Git revision and retain both output folders. The manifest lists the SHA-256 of the HTML, each asset and `dist-edge/worker.js`. Use a dedicated origin with root-relative object paths that do not route back through the Edge app.
2. Upload only the manifest's listed assets to the approved origin, including the notice, using the specified content types. Verify each object's GET bytes and HEAD status through HTTPS. Confirm that the origin does not redirect and that its CDN preserves the headers needed for those requests.
3. Upload `dist-edge/worker.js` to the approved test app through the ArvanCloud panel. Record its deployment ID. If using a custom staging hostname, verify that its approved route covers `/`, `/health`, `/assets/*`, and `/THIRD-PARTY-NOTICES.txt`. Keep the inline startup failure handler permitted by the staging site's script policy.
4. Request the root, health, one JavaScript file, the PNG and the notice over the actual staging HTTPS URL. Check the status, media type, cache headers, and hashes against the manifest. Check HEAD, a missing asset, a disallowed method, and a query URL. Test HEAD forwarding and redirect rejection with the approved staging fixture if available. Open the app in a fresh Chromium profile, verify the scene renders, and inspect the provider's Edge execution evidence for that deployment. Record any provider-specific behaviors or inaccessible checks.
5. Retain previous staging artifacts and their configuration. If an approved rollback is needed, restore the archived worker with its matching assets. For a custom route, first use the dashboard's route disable control if the approved rollback calls for it. Confirm the resulting HTTP responses. The first test deployment may have no previous build to restore. [Route controls](https://docs.arvancloud.ir/fa/edge-computing/trigger/path/)
