---
title: Sportlink club address book
description: Search clubs by name or city and read their contact roles through the protected Rondo and Sync APIs.
---

**Voetbal → Verenigingen** searches Sportlink for club addresses and contact people.
Search by name or city, then open a club and filter its contacts by function.
The address book reads Sportlink on demand and creates no Rondo people or teams.

## Access and results

Approved users need access to either `teams` or `wedstrijdzaken`; administrators
retain access. The current-user response exposes `can_access_wedstrijdzaken`.
The navigation and direct routes `/voetbal/verenigingen` and
`/voetbal/verenigingen/{id}` share that permission check.
Match-affairs access alone does not grant general team access.

Use 2–80 characters after trimming spaces, with `field=name|city` (default `name`).
It searches all districts and excludes liquidated clubs. Results contain at most
100 clubs, with the full source `total` and a `truncated` flag. Narrow the query
when it is truncated. The interface retains the query when returning from a detail.

A club has `id`, `name`, `district`, `address`, `postcode`, `city`, `phone` and
`email`. A contact row has `id`, `name`, `function`, `phone`, `mobile`, `email`
and `source`. One person may have several function rows. Missing contact details
stay empty; the interface offers phone and email links only when present.
`fetched_at` records the source read time, displayed in Europe/Amsterdam.

## WordPress API and cache

Paths are relative to `/wp-json/rondo/v1`:

| Method and path | Response |
|---|---|
| `GET /external-clubs?search=Example&field=name` | `{clubs, total, truncated, fetched_at}` |
| `GET /external-clubs/{id}` | `{club, contacts, fetched_at}` |

Club IDs are exactly seven uppercase letters or digits. Before returning contacts, detail reads check that the source ID matches. WordPress checks and cleans the allowed fields, contact lists and result counts.

`RONDO_SYNC_URL` and `RONDO_SYNC_API_KEY` configure the server-side connection.
WordPress calls Sync with `X-Sync-API-Key`, a 180-second timeout, no redirects and
a 2 MiB response limit. The browser allows 190 seconds for a cold lookup.
Credentials and upstream errors never become response fields.

Valid search and detail responses use native transients for fifteen minutes.
Rondo checks access before every cached read. Responses send
`Cache-Control: private, no-store`; the React query also stays fresh for fifteen
minutes and disables automatic retries and focus refetches.

Missing configuration returns 503. Invalid search input returns 400; unavailable
clubs retain 404 and a busy directory retains 429. Transport failures and invalid
source data return 502. Failed or incomplete reads are not cached as empty results.
A validated empty source list is a successful search.

## Sync source adapter

[Sync's directory routes](/sync/web-api/#club-address-book) require the existing
API key. `ClubDirectory` uses `SportlinkSession` to open the address-book SPA and
capture its successful `SearchClubFilter` request headers. It keeps only `accept`,
`authorization` and the three required `x-navajo-*` headers in memory.

Subsequent reads call the fixed Sportlink JSON endpoints `ClubSearchList` and
`ClubOfficials`; they do not scrape HTML tables. Requests have a 20-second timeout
and reject redirects. An HTTP 401 permits one session relogin and header refresh.
Detail reads fail if the club ID is unclear or contacts belong to another club.

One lookup runs per directory instance; a concurrent uncached request receives
429. The session closes on failure, server shutdown or five minutes of inactivity.
Unexpected errors become a generic message without source URLs, bodies or tokens.
This read adapter does not launch a sync pipeline or write the local member mirror.

`ClubDirectoryTest.php`, `clubDirectoryAccess.test.mjs` and Sync's
`test/club-directory.test.js` cover access revocation, caching, validation,
identity matching, bounded concurrency and authentication recovery.
