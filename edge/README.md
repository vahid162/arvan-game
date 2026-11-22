# Edge delivery

## Local verification

From the repository root, run `npm run test:edge` for the route contract and `npm run test:browser:edge` to exercise the generated Edge handler in Chromium. The browser command builds the artifacts and uses port 4174. [Browser setup](../README.md#build-and-verify)

For a manual session, run `npm run build:edge`, then `npm run preview:edge`. Open `http://127.0.0.1:4174/`. The Node harness loads the bundled script and sends asset requests to a separate loopback HTTP server. This works with the reserved local build origin `https://p02-assets.test` and requires no network account.

| Path | Expected GET and HEAD result |
| --- | --- |
| `/` with an optional single `lang` parameter | 200 HTML, `Cache-Control: no-cache` |
| `/health` | 200 JSON, `Cache-Control: no-store`, Edge marker `X-Light-Hunt-Edge: p02` |
| Exact versioned paths listed in `dist-edge/manifest.json` | 200 with the listed content type and `Cache-Control: public, max-age=31536000, immutable` |
| `/THIRD-PARTY-NOTICES.txt` | 200 text, `Cache-Control: no-cache` |
| Unknown path | 404 with `Cache-Control: no-store` |

HEAD returns the matching status and headers with an empty body. Other methods return 405 with `Allow: GET, HEAD`. The entry page handles supported language choices and falls back for other values. Other query parameters return 400. The handler returns 502 for an unreachable origin, a redirect, an unexpected upstream status other than 404, or a MIME mismatch.

## Build and archive a release

Use the exact Node version in `.nvmrc` and npm version in `package.json`. From a clean checkout run `npm ci`, `npm run test:edge`, then `npm run build:edge`. For local checks the reserved origin is sufficient. For an approved staging candidate set `LIGHT_HUNT_ASSET_ORIGIN` **before building** to the exact separate HTTPS origin that serves root-relative object paths. The build rejects credentials, path prefixes, queries and fragments. The Edge host and origin must have different hostnames. Keep origin credentials outside the browser and worker.

Archive the complete `dist/` and `dist-edge/` directories together, outside the working tree. `dist/` contains the current browser release. `dist-edge/` contains a standalone worker, a manifest, and any additional immutable assets needed for older open tabs. The worker embeds the entry HTML and the exact paths it will serve. The manifest records:

| Identity | What to compare |
| --- | --- |
| `source.revision`, `source.dirty`, `source.buildInputsSha256`, `source.lockfileSha256`, `nodeVersion` | Full Git revision, worktree status, SHA-256 of the sorted build input names and digests, literal package-lock file digest and Node runtime. A source archive without Git metadata has a null revision/status. Use an identified clean revision for staging. |
| `browserSha256`, `entryHtmlSha256`, `assets` | Digest of the sorted current browser path/digest pairs, literal HTML digest and each current origin object's type, bytes and SHA-256. |
| `origin`, `workerSha256`, `retainedAssets` | Embedded origin, literal deployment script digest and any older paths that this worker also accepts. |

To check reproducibility, independently install and build the same clean revision twice using the same Node, npm, origin and retained archive. Run `diff -qr FIRST/dist SECOND/dist` and `diff -qr FIRST/dist-edge SECOND/dist-edge`, replacing FIRST and SECOND with the checkout paths. Both comparisons should be empty. Record the two output identities, lock and revision with the test results. The default and staging origins produce different workers.

For an update, set `LIGHT_HUNT_RETAINED_RELEASE` to the **absolute directory containing the previous archive's** `dist/` **and** `dist-edge/` before running the build. The archive must use the same origin. The build carries forward its immutable paths, including older retained paths, fails on conflicting bytes at an immutable URL, and copies required old files into `dist-edge/retained/assets/`. Upload current objects from `dist/` and any missing retained objects from `dist-edge/retained/`, keeping their exact paths. Never replace a versioned object with different bytes. The notice at the root belongs to the active release. Agree on an asset retention period and the expected storage/allowlist growth before any deletion or retirement build.

## Staging inputs and probe

In the named account, confirm the existing Edge app's staging URL (a provider-assigned test URL or dedicated staging hostname), the separate HTTPS Storage/CDN origin, and the supported method for publishing the prebuilt script and identifying its deployment. A custom staging hostname also requires an approved route. Check the account's current controls and permissions with the operator. [Edge dashboard](https://docs.arvancloud.ir/fa/edge-computing/dashboard/) · [Routing](https://docs.arvancloud.ir/fa/edge-computing/trigger/path/) · [Storage website](https://docs.arvancloud.ir/fa/object-storage/buckets/static-website/)

Record the following values from the account owner before uploading. No staging account, billable resource or budget is assigned by this repository. Keep credentials in the provider or approved credential store. [ArvanCloud pricing](https://www.arvancloud.ir/fa/pricing/edge-computing) · [Environment values](https://docs.arvancloud.ir/fa/edge-computing/env-variables/)

| Needed from the operator | Exact value or decision |
| --- | --- |
| Target and routes | Account/tenant, project and existing Edge app identifiers, staging HTTPS URL, route patterns, separate HTTPS asset origin and its storage bucket/CDN mapping to the root paths. Confirm existing origin and route ownership. |
| Permissions | Named operator and approver, authorization to upload objects, publish the worker, inspect routes, usage and deployment logs, and perform the agreed rollback. Specify any allowed route changes separately. |
| Quotas and budget | Remaining requests and traffic for the test window, worker upload/size limits, storage and egress allowance, applicable rates and currency, maximum paid amount, stop threshold, end time and person monitoring usage. Include other account usage when the allowance is shared. |
| Candidate and recovery | Approved revision and hashes, artifact archive location, previous deployment/route IDs or first-deployment recovery action, retention period, rollback trigger and person authorized to apply it. |

1. Build and archive the identified staging candidate using the approved origin and previous archive. Compare the worker size and aggregate object bytes with the confirmed limits. Keep the previous release archive and route configuration available throughout the test.
2. Upload the manifest's current and retained objects to the approved origin, including the active notice, using the specified content types. Verify each object's GET bytes and HEAD status over HTTPS. Confirm that the origin does not redirect. Before switching, keep an existing staging tab open with its gameplay chunk still unloaded.
3. Publish `dist-edge/worker.js` to the approved test app using the confirmed account controls. Record its deployment ID. If using a custom staging hostname, verify that its approved route covers `/`, `/health`, `/assets/*`, and `/THIRD-PARTY-NOTICES.txt`. Keep the inline startup failure handler permitted by the staging site's script policy.
4. Request the root, its language variants, health, one JavaScript file, the PNG, the WOFF2 font and the notice over the actual staging HTTPS URL. Check the status, media type, cache headers, and hashes against the manifest. Check HEAD, a missing asset, a disallowed method, and an unsupported query. Test HEAD forwarding and redirect rejection with the approved staging fixture if available. Open the app in a fresh Chromium profile, verify the scene renders, and inspect the provider's Edge execution evidence for that deployment. Record any provider-specific behaviors or inaccessible checks.
5. Trigger gameplay in the older tab and confirm its previous chunk still returns the archived bytes. In a new tab confirm the candidate entry and chunks match the new hashes. Record the deployment ID, observed cache headers, origin/Edge request and cost counters, errors and elapsed test window. Actual provider HTTPS, device, voluntary player and owner acceptance each require their own observations.

## Rollback

Choose and rehearse the recovery before the switch. A previous worker with only its own allowlist cannot serve lazy chunks to tabs opened on the candidate. When both releases must keep working, prepare a recovery worker for the **previous browser release** that also allowlists the candidate's immutable paths, using the same origin. With the retained-release builder, package the previous archived `dist/` with `LIGHT_HUNT_RETAINED_RELEASE` pointing to the candidate archive. Verify that its entry HTML and browser digest still match the previous release; archive and approve the recovery worker's own digest. An older builder without retained-release support requires this packaging step with the identified compatible builder revision and both source identities recorded.

Verify the previous application can read saves issued by the candidate before switching back. Current v1 saves can contain `seeded-forest-1` mission receipts for both `forest-routes-1` and `forest-routes-2`. Exercise an in-progress assignment and an upgraded or completed profile without clearing storage. A rollback target unable to read issued saves needs a compatible recovery build. Restore the prior notice and approved worker/route configuration, keeping both immutable sets available. Verify the previous HTML hash, health and old/new chunk bytes from warm and fresh tabs; record the resulting deployment ID. For a first deployment use the specifically approved route/app recovery action. [Route controls](https://docs.arvancloud.ir/fa/edge-computing/trigger/path/)
