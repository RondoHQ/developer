---
title: Error monitoring with GlitchTip
---

Rondo sends filtered errors and performance transactions to its self-hosted GlitchTip service at `https://errors.rondo.club`. Events contain diagnostic locations and release versions. Original application error messages are excluded from outgoing events. Application projects include `rondo-react`, `rondo-wordpress`, `rondo-sync` and `rondo-website`.

## Application configuration

| Application | Configuration | Captured errors |
| --- | --- | --- |
| Club frontend | WordPress constants `RONDO_GLITCHTIP_REACT_DSN` and optional `RONDO_GLITCHTIP_ENVIRONMENT` | React caught/uncaught errors, application startup exceptions and API responses with status 500 or higher |
| Club PHP | `RONDO_GLITCHTIP_DSN` and optional `RONDO_GLITCHTIP_ENVIRONMENT` | Fatal error types: `E_ERROR`, `E_PARSE`, `E_CORE_ERROR`, `E_COMPILE_ERROR`, `E_USER_ERROR`, `E_RECOVERABLE_ERROR` |
| Sync | Private environment `GLITCHTIP_DSN` and optional `GLITCHTIP_ENVIRONMENT` | Tracked step errors, failed/partial runs, process crashes and dashboard errors without a status code or with status 500 or higher |
| Marketing website | Public ingestion DSN in `src/lib/error-monitoring-config.js`; optional Pages runtime `GLITCHTIP_DSN` override | Production browser errors, contact request failures and operational failures in Pages Functions |

Club and Sync default to environment `production`; without their corresponding DSN, monitoring remains disabled. Club uses release `rondo-club@{theme-version}`; Sync uses `rondo-sync@{package-version}`. The website uses `rondo-website@{package-version}` and enables browser reporting only on `rondo.club` and `www.rondo.club`. Its Functions also permit an explicit runtime DSN for test environments. The website release is a plain JavaScript constant checked against `package.json`, because the Pages production bundler cannot parse JSON import attributes.

PHP loads through the `rondo-error-monitoring.php` MU-plugin before ordinary plugins and the theme. It resolves the SDK and monitoring class from the current `wp-content/themes/rondo-club` release. The theme's `style.css` supplies the release version, including after rollback. The fallback deploy script copies the loader into WordPress's MU-plugin directory.

Sync reporting catches monitoring failures so they cannot interrupt normal work. It flushes events at run completion; crash handlers allow a bounded two-second flush before exiting. PHP uses a two-second HTTP timeout and one-second connect timeout.

## Outgoing data contract

Each SDK filters events before sending them. User data, request headers and bodies, breadcrumbs, extra context and original exception messages are discarded. Club browser and Sync stack frames retain filenames without query strings or fragments, function names and line/column positions. Club browser events also retain debug metadata for source resolution.

Website stack filenames are restricted to production `/_astro/*.js` files and relative JavaScript/TypeScript paths. PHP frames remove variables and source-code context. Sync error tags allow `pipeline`, `step`, `outcome` and a locally classified `error_code`; website error tags allow only the fixed contact-processing `stage`.

Default personal-data collection, client reports and breadcrumbs are disabled in the browser and Sync SDKs. Performance transactions have their own filters; error filtering alone does not protect traces. Do not add member identifiers or raw payloads to monitoring events.

### Sync error grouping

Sync fingerprints contain `rondo-sync`, pipeline, step (or `run`) and a safe diagnostic code. Known causes such as `sportlink_session_expired`, `sportlink_vog_incomplete`, `sportlink_teams_incomplete`, `team_history_conflict`, `request_timeout`, `connection_reset` and `dns_failure` remain separate without including member IDs, release versions or raw provider errors in the fingerprint. Unknown causes use `unclassified_error` plus the SDK's default stack grouping. Private local logs retain the original message for investigation.

## Performance measurements

| Application | Sampling and measurements | Disable performance independently |
| --- | --- | --- |
| Club React | 10% of page loads/navigation; trace propagation only to the site's `/wp-json/` requests | WordPress constant `RONDO_GLITCHTIP_REACT_PERFORMANCE=false` |
| Club PHP | Registered `/rondo/v1/` and `/wp/v2/` routes; inherits a valid parent sampling decision, otherwise samples 10%; REST callback plus at most 99 outbound HTTP spans | WordPress constant `RONDO_GLITCHTIP_PHP_PERFORMANCE=false` |
| Sync | One transaction per completed tracked run and step, plus failed runs on crash; shared trace ID and original RunTracker timestamps preserve long durations | Environment `GLITCHTIP_PERFORMANCE=false` |
| Website browser | 10% of page loads/navigation, with no outgoing trace propagation | Build variable `PUBLIC_GLITCHTIP_PERFORMANCE=false` |
| Website Functions | Contact POST requests sampled at 100%, subject to a soft 1,000-per-UTC-day budget in `PERFORMANCE_BUDGET` KV | Runtime variable `GLITCHTIP_PERFORMANCE=false` |

These switches leave error reporting enabled. Browser and Sync SDKs use the static transaction lifecycle. Browser filters retain timing, trace IDs, release/environment and at most 100 spans. Known route segments remain readable; other segments become `:id`. Query strings, fragments, arbitrary attributes and resource URLs are discarded. PHP names transactions from registered route patterns, replaces named parameters with `:id`, and labels outbound requests only with an allowed provider hostname or `external`; it records no SQL.

Sync transactions allow only configured pipeline/step labels, outcome and nonnegative finite aggregate `created`, `updated`, `skipped` and `failed` counts. They contain no per-member spans or tracker detail payloads. The contact handler uses fixed `/api/contact/turnstile` and `/api/contact/email` spans. Missing or unavailable budget KV drops contact transactions. KV's eventual consistency makes this a soft ceiling that concurrent requests can exceed.

## Same-origin browser diagnostics

Club browsers send envelopes to `POST /wp-json/rondo/v1/diagnostics`; website browsers use `POST /api/diagnostics`. These public ingestion routes require the exact same-site `Origin` and reject `Sec-Fetch-Site: cross-site`. They do not read club records or require a login nonce. Both validate a maximum 65,536-byte envelope containing exactly one JSON error or transaction, a matching event ID and the configured browser-project DSN. Attachments, replay payloads and other project destinations are rejected. Event privacy filtering still happens in the SDK before transport.

Both transports relay only to their fixed `errors.rondo.club` envelope destination, with a three-second timeout, no redirects and no browser cookies or authentication headers. Successful ingestion returns empty HTTP 204; responses use `Cache-Control: no-store`. Malformed envelopes return 400, oversized bodies 413, exhausted budgets 429, upstream non-throttling failures 502, and disabled/unavailable transport 503. Upstream `Retry-After` and `X-Sentry-Rate-Limits` are preserved. Website non-POST requests receive 405.

Soft limits are 20 requests per source IP per minute and 2,000 per UTC day. Club uses non-atomic WordPress transients keyed by a salted, minute-specific IP hash; the website uses separate diagnostic counters in `PERFORMANCE_BUDGET` KV with a minute-specific IP hash. Raw IP addresses are not stored in these counter keys. Missing website KV rejects forwarding with 429; a KV exception returns 503. Disable the transports with WordPress `RONDO_GLITCHTIP_TUNNEL=false` or website runtime `GLITCHTIP_TUNNEL=false`. The diagnostics routes bypass performance instrumentation to prevent recursive transactions.

## Frontend source maps and deployment

Vite generates hidden source maps and uses the Sentry Vite plugin to upload them to the `rondo-react` project. The plugin runs when `SENTRY_AUTH_TOKEN` is present, attaches release/commit metadata and deletes `dist/**/*.map` after upload. Workbox source maps are disabled.

The production workflow supplies this token from the `GLITCHTIP_AUTH_TOKEN` repository secret. It fails when the token is absent or any `.map` file remains in `dist`. The token is restricted to `org:read`, `project:read` and `project:releases`. Keep it out of browser configuration and Git. A local build without the token still generates maps, so do not publish that output as a production release.

## Sync health endpoint

`GET /health/sync` is a public aggregate uptime check. It returns HTTP 200 with `{ "status": "ok" }`, or HTTP 503 with `{ "status": "overdue" }`. It exposes no member data or pipeline details. The separate `/health` route checks the dashboard server itself.

Health compares each pipeline's latest completed run with its previous due slot from the configured schedule. It looks up the slot at one hour before now for interval jobs, or four hours before now for other jobs. The completed run must have started at or after that slot and have outcome `success` or `partial`. A currently running job alone does not satisfy the check. Failures and missing runs make the aggregate unhealthy.

Disabled/manual schedules and changed schedules before their first eligible slot have no due slot and are exempt. Twelve uses its cached club opening-hours schedule. Partial runs count as active for uptime, while their errors remain in GlitchTip. See [Web Server API](/sync/web-api/#health-endpoints) and [Editable Sync Schedules](/sync/schedules/).

## Hosting, alerts and backups

Operations files live in `rondo-sync/ops/glitchtip/`. The configured service runs under `/opt/glitchtip` on the Sync VPS. Nginx serves HTTPS with a Certbot certificate and proxies to loopback port 8000. Docker Compose runs the pinned GlitchTip 6 image and PostgreSQL 18, with persistent database/uploads volumes and restart policies. GlitchTip has a 1.5 GiB memory limit and one CPU; PostgreSQL has a 512 MiB memory limit.

Private `postgres.env` and `glitchtip.env` files supply credentials and settings outside Git. The documented server configuration uses `all_in_one`, 30-day error retention and disabled public registration/organization creation.

Performance storage uses `GLITCHTIP_TRANSACTION_RETENTION_DAYS=14`, `GLITCHTIP_SPAN_RAW_RETENTION_DAYS=14`, `GLITCHTIP_ENABLE_DUCKDB=true` and `GLITCHTIP_COLD_STORAGE_DIR=/code/cold-storage`. The private `cold-storage` Docker volume must be owned by the image app user, UID/GID `5000:5000`. DuckDB also handles error archival; the existing 1.5 GiB container memory limit remains in place.

`lettermint_backend.EmailBackend` sends alerts through Lettermint using the private `LETTERMINT_API_TOKEN`. Provider acceptance is logged; it does not prove inbox delivery.

`rondo-glitchtip-backup.timer` runs around 04:20 server time, with up to five minutes of randomized delay. The backup script uses a lock and private file permissions. Archives contain a PostgreSQL custom-format dump, uploads, `cold-storage.tar`, Compose configuration, the email backend and secret environment files. It prunes complete archives older than 14 days. These backups are local to the VPS; external Sync heartbeat monitoring remains necessary to detect a lost server.

Inspect the timer with `systemctl status rondo-glitchtip-backup.timer` and service output with `journalctl -u rondo-glitchtip-backup.service`. Before upgrading, run `/opt/glitchtip/backup.sh`. Restore a dump into a separate database and verify it before switching production. Restore uploads and cold storage into their corresponding volumes and preserve the original GlitchTip secret key. Verify transaction-group counts, recent span names and storage usage separately from HTTP ingestion responses. Keep archives and environment files out of tickets and logs.

## Source verification

Club's `ErrorMonitoringTest` and `tests/js/error-monitoring.test.mjs` check outgoing event filtering while preserving stack locations. Sync's `test/error-monitoring.test.js` covers filtering, disabled monitoring, missed interval runs, partial outcomes and schedule exemptions. Deployment completion, SDK ingestion, TLS, source resolution and alert delivery are separate checks; source review alone does not establish their live status.

Club's `PerformanceMonitoringTest` covers route naming, parent sampling, nested REST calls, outgoing payloads and the diagnostics exclusion. `MonitoringTunnelTest` and Website's `tests/monitoring-tunnel.test.mjs` cover forwarding boundaries and budgets. Browser performance tests check privacy and the 100-span bound; Sync's performance tests check long steps and the shared run/step trace; website middleware tests check contact budgets and transport recursion prevention. See [Marketing website](/architecture/website/) for the contact failure contract.
