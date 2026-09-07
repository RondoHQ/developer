---
title: Team matches and calendar subscriptions
---

The **Wedstrijden** tab on each team page lists the current July–June season, with home/away matches, results, venues, pitches, cancellations, and whole-season/upcoming/past filters. It includes only fixtures already published by Sportlink. Youth competitions may publish later phases during the season; some age groups do not publish results.

## Data source and team identity

`Rondo\Teams\TeamMatches` uses the existing `SportlinkMatchday` Club.Data HTTP adapter and fixture normalizer. Credentials remain server-side, using the Club TV Sportlink configuration; this does not alter Club TV's matchday windows.

The `teams` directory is cached for one hour with both official and local names. Union teams use exact official names plus the synchronized activity's weekday; `CT` PublicTeamIds use the local name. Repeated competition entries are deduplicated by union team code. Linked local IDs are included for friendly matches. Ambiguous or missing mappings return `matched: false` rather than guessing from a similar name. This also handles old teams absent from the current directory.

`programma` and `uitslagen` are requested from the week containing July 1 for 380 days, and filtered to the exact season and team IDs. This explicit ID filtering is necessary because Sportlink may include unrelated local fixtures in a team-filtered request. Results take precedence over programme rows with the same match code. A response reaching the requested 500-row bound is treated as incomplete and does not replace the cache.

The per-team `_rondo_team_matches_cache` post meta retains the season's fixtures and revisions. Requests refresh it after 15 minutes; a transient lock limits concurrent fetches. Failures preserve the previous payload, return `stale: true`, and back off for one minute. An initial failure returns HTTP 503, never a successful empty calendar. Previously seen historical fixtures are retained; disappeared future fixtures become cancellation tombstones. No separate match tables or personal player data are involved.

## REST API

- `GET /rondo/v1/teams/{id}/matches`: requires the normal team read permission and a published team. Returns `season`, `matched`, `matches`, `stale`, `updated_at`, and `calendar_url`.
- `GET /rondo/v1/teams/{id}/matches.ics?token=...`: returns raw `text/calendar`. It requires a valid team-scoped HMAC token, and works without cookies or a WordPress nonce. The token is bound to the team ID and PublicTeamId using the WordPress authentication salt. Changing that identity or rotating the salt invalidates old links; trashing or unpublishing the team also blocks access.

The calendar link is a shareable capability granting access only to fixture information, never members or contact information. The overview only exposes it to users who can read the team. An unmatched team has an empty calendar until it can be resolved; an existing cached team whose mapping disappears retains its last-known-good calendar.

## Calendar behavior

Use **Abonneren op agenda** (`webcal:`) or **Kopieer ICS-link** (HTTPS) to subscribe in a calendar application. Importing an ICS file once does not create a subscription. Refresh timing is controlled by the calendar application; the hourly hints are advisory.

Each event has a stable match/team UID, persistent SEQUENCE and LAST-MODIFIED values, UTC start time, location, and cancellation status. Unknown kickoff times produce an all-day entry rather than inventing a time. No end time is invented. Scores are included when published. Renames and rescheduling update the existing event, and expiring logo signatures do not increment revisions. Calendar text uses RFC 5545 escaping, CRLF line endings, and UTF-8-safe folding at 75 octets.

## Verification

`vendor/bin/codecept run Wpunit TeamMatchesTest` covers team/day disambiguation, local match inclusion, season filtering, result merging, outage retention, cancellation tombstones, event revisions, Unicode folding, unknown times, and signed subscription permissions.
