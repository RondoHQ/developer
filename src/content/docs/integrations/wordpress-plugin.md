---
title: Rondo WordPress plugin
---

The standalone `rondo-wordpress-plugin` publishes a Rondo Club training schedule on a club's public WordPress website. It does not require the Rondo Club theme on the consuming website.

## Setup

1. Install and activate the **Rondo** plugin ZIP on the club website (WordPress 6.3+, PHP 8.0+).
2. Open **Instellingen → Rondo**, enter a public schedule endpoint and save.
3. Insert the **Rondo trainingsschema** Gutenberg block, or `[rondo_trainingsschema]` in a shortcode block.

Both insertion methods use the same administrator-configured endpoint. A fixed schedule uses `/wp-json/rondo/v1/training/schedules/{id}`; `/wp-json/rondo/v1/training/active` automatically follows Rondo's active version. No account, application password or nonce is needed to read either endpoint. The plugin never writes back to Rondo Club.

The Gutenberg block is registered as `rondo/training-schedule`, with a server-rendered preview and wide/full alignment support. Multiple instances have independent day filters and view controls, with unique accessible IDs. Version 1.0 supports one source endpoint per WordPress installation.

## Rendering contract

The plugin consumes `{schedule, pitches, timezone}` from the [Training schedules API](/api/training-schedules/). It validates the complete response before caching. Weekdays are ISO 1–7, rows are 15 minutes, and pitch allocation uses Rondo's quarter units (`size=0.5` means an eighth). Eighths are labeled A1–D2; halves use AB/CD, three quarters ABC/BCD and whole pitches ABCD. Blocks may end at 24:00 but cannot cross midnight.

The display title prefers `label`, falling back to `team_names`. Colors come from `color`, with automatic black/white contrast. Unused days and pitches are omitted; configured pitch order is retained. All displayed days share the earliest start and latest end of the week. Times remain the club's local times, without browser timezone conversion.

Desktop defaults to a horizontally scrollable timetable; screens up to 640px default to a list. A visitor can choose either view and filter by weekday. Both layouts are server-rendered and remain available without JavaScript. Print styles support the selected view.

## Connection and caching

Only administrators can configure or refresh the source. Settings use the WordPress Settings API and the explicit refresh form checks both capability and nonce. URLs must be HTTPS and match a supported schedule path, without credentials, queries, fragments or alternative ports. `wp_safe_remote_get()` validates destinations; redirects are disabled, timeout is eight seconds and response bodies are limited to 2 MB. Remote content is validated, sanitized and escaped before rendering.

WordPress transients hold the current response for five minutes and the last valid response for at most 24 hours. Retrieval is request-driven, not a background polling process. A network error, HTTP 429/5xx or malformed response can fall back to the last valid data with a visible warning and retrieval time. Failures have a one-minute retry cooldown. Non-temporary HTTP errors, including 401/403/404, invalidate the backup. A valid empty schedule replaces the previous cache rather than retaining old training blocks.

Changing the endpoint or clicking **Schema nu bijwerken** clears the plugin's cache. Full-page caching and CDN caches are separate: exclude the training page for prompt updates, or configure a short TTL and clear that cache after urgent changes. Layered cache durations can add together. Already open browser pages are not automatically refreshed.

## Development and verification

Repository: `RondoHQ/rondo-wordpress-plugin`. There is no frontend build step or runtime dependency installation. The Gutenberg editor uses WordPress-provided scripts; the public UI uses scoped CSS and plain JavaScript.

- `composer lint` runs WordPress coding and security standards.
- `wp --path=/disposable/wordpress eval-file tests/integration.php` checks the real WordPress registration, rendering, validation and cache behavior with controlled HTTP responses. Activate the plugin first and use a disposable database.
- `python3 bin/package.py` creates a ZIP from an explicit runtime allowlist and checks version consistency.
- Verify both frontend insertion methods, the actual block editor, settings connection, day filter, responsive list and horizontal scrolling with a real public endpoint before release.
