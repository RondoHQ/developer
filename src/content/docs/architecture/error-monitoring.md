---
title: Error monitoring with GlitchTip
---

Rondo sends React, PHP and sync errors to its self-hosted GlitchTip service at `https://errors.rondo.club`. Events contain diagnostic locations and release versions. Original messages stay in private application logs. The three projects are `rondo-react`, `rondo-wordpress` and `rondo-sync`.

## Application configuration

| Application | Configuration | Captured errors |
| --- | --- | --- |
| Club frontend | WordPress constants `RONDO_GLITCHTIP_REACT_DSN` and optional `RONDO_GLITCHTIP_ENVIRONMENT` | React caught/uncaught errors, application startup exceptions and API responses with status 500 or higher |
| Club PHP | `RONDO_GLITCHTIP_DSN` and optional `RONDO_GLITCHTIP_ENVIRONMENT` | Fatal error types: `E_ERROR`, `E_PARSE`, `E_CORE_ERROR`, `E_COMPILE_ERROR`, `E_USER_ERROR`, `E_RECOVERABLE_ERROR` |
| Sync | Private environment `GLITCHTIP_DSN` and optional `GLITCHTIP_ENVIRONMENT` | Tracked step errors, failed/partial runs, process crashes and dashboard errors without a status code or with status 500 or higher |

The environment defaults to `production`. Without the corresponding DSN, monitoring remains disabled. Club uses release `rondo-club@{theme-version}`; Sync uses `rondo-sync@{package-version}`.

PHP loads through the `rondo-error-monitoring.php` MU-plugin before ordinary plugins and the theme. It resolves the SDK and monitoring class from the current `wp-content/themes/rondo-club` release. The theme's `style.css` supplies the release version, including after rollback. The fallback deploy script copies the loader into WordPress's MU-plugin directory.

Sync reporting catches monitoring failures so they cannot interrupt normal work. It flushes events at run completion; crash handlers allow a bounded two-second flush before exiting. PHP uses a two-second HTTP timeout and one-second connect timeout.

## Outgoing data contract

Each SDK filters events before sending them. User data, request headers and bodies, breadcrumbs, extra context and original exception messages are discarded. Browser and Sync stack frames retain filenames without query strings or fragments, function names and line/column positions. Browser events also retain debug metadata for source resolution. PHP frames remove variables and source-code context. Sync tags allow only `pipeline`, `step` and `outcome`.

Default personal-data collection is disabled. Browser and Sync tracing and client reports are disabled, and breadcrumbs are disabled across all three applications. Use private local logs when an issue needs the original error message. Do not add member identifiers or raw payloads to monitoring events.

## Frontend source maps and deployment

Vite generates hidden source maps and uses the Sentry Vite plugin to upload them to the `rondo-react` project. The plugin runs when `SENTRY_AUTH_TOKEN` is present, attaches release/commit metadata and deletes `dist/**/*.map` after upload. Workbox source maps are disabled.

The production workflow supplies this token from the `GLITCHTIP_AUTH_TOKEN` repository secret. It fails when the token is absent or any `.map` file remains in `dist`. The token is restricted to `org:read`, `project:read` and `project:releases`. Keep it out of browser configuration and Git. A local build without the token still generates maps, so do not publish that output as a production release.

## Sync health endpoint

`GET /health/sync` is a public aggregate uptime check. It returns HTTP 200 with `{ "status": "ok" }`, or HTTP 503 with `{ "status": "overdue" }`. It exposes no member data or pipeline details. The separate `/health` route checks the dashboard server itself.

Health compares each pipeline's latest completed run with its previous due slot from the configured schedule. It looks up the slot at one hour before now for interval jobs, or four hours before now for other jobs. The completed run must have started at or after that slot and have outcome `success` or `partial`. A currently running job alone does not satisfy the check. Failures and missing runs make the aggregate unhealthy.

Disabled/manual schedules and changed schedules before their first eligible slot have no due slot and are exempt. Twelve uses its cached club opening-hours schedule. Partial runs count as active for uptime, while their errors remain in GlitchTip. See [Web Server API](/sync/web-api/#health-endpoints) and [Editable Sync Schedules](/sync/schedules/).

## Hosting, alerts and backups

Operations files live in `rondo-sync/ops/glitchtip/`. The configured service runs under `/opt/glitchtip` on the Sync VPS. Nginx serves HTTPS with a Certbot certificate and proxies to loopback port 8000. Docker Compose runs the pinned GlitchTip 6 image and PostgreSQL 18, with persistent database/uploads volumes and restart policies. GlitchTip has a 1.5 GiB memory limit and one CPU; PostgreSQL has a 512 MiB memory limit.

Private `postgres.env` and `glitchtip.env` files supply credentials and settings outside Git. The documented server configuration uses `all_in_one`, 30-day event retention and disabled public registration/organization creation. `lettermint_backend.EmailBackend` sends alerts through Lettermint using the private `LETTERMINT_API_TOKEN`. Provider acceptance is logged; it does not prove inbox delivery.

`rondo-glitchtip-backup.timer` runs around 04:20 server time, with up to five minutes of randomized delay. The backup script uses a lock and private file permissions. Archives contain a PostgreSQL custom-format dump, uploads, Compose configuration, the email backend and secret environment files. It prunes complete archives older than 14 days. These backups are local to the VPS; external Sync heartbeat monitoring remains necessary to detect a lost server.

Inspect the timer with `systemctl status rondo-glitchtip-backup.timer` and service output with `journalctl -u rondo-glitchtip-backup.service`. Before upgrading, run `/opt/glitchtip/backup.sh`. Restore a dump into a separate database and verify it before switching production. Restore uploads and preserve the original GlitchTip secret key. Keep archives and environment files out of tickets and logs.

## Source verification

Club's `ErrorMonitoringTest` and `tests/js/error-monitoring.test.mjs` check outgoing event filtering while preserving stack locations. Sync's `test/error-monitoring.test.js` covers filtering, disabled monitoring, missed interval runs, partial outcomes and schedule exemptions. Deployment completion, SDK ingestion, TLS, source resolution and alert delivery are separate checks; source review alone does not establish their live status.
