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

The calendar link is a shareable capability granting access only to fixture information, never members or contact information. The overview exposes it to users who can read the team. My Details also exposes it for the current teams of people already included in the household response. An unmatched team has an empty calendar until it can be resolved; an existing cached team whose mapping disappears retains its last-known-good calendar.

## My Details household teams

`GET /rondo/v1/people/household` adds `teams: [{ id, name, calendar_url }]` for each existing household person (self, minor children, and other parents). Only published teams from currently dated work-history roles are included, with duplicate player/staff roles collapsed. Past and future roles, committees, and external teams are omitted. An end date equal to today is still current. Explicit dates override a stale `is_current` flag.

This derived list does not expose raw work history, expand the household graph, or change the other parent's contact, pass, or invoice permissions. URL generation uses `TeamMatches::calendar_url()` and makes no Sportlink requests. The shared `TeamCalendarActions` component renders the same subscription popover and copy action on **Mijn team** and the team match tab. **Mijn gegevens** no longer renders calendar actions. The household API retains its existing `teams` field for compatibility; `/rondo/v1/my-teams` now provides `calendar_url` for each team already authorized by the personal roster access rules.

## Calendar behavior

Use **Abonneren op agenda** to open a subscription popover with a copyable HTTPS URL and instructions for Google Calendar, Outlook, and device calendar apps. A `webcal:` link is offered inside the device-app instructions; the popover remains useful when the browser has no protocol handler. **Kopieer ICS-link** copies the same shareable URL. Importing an ICS file once does not create a subscription. Refresh timing is controlled by the calendar application; the hourly hints are advisory.

Each event has a stable match/team UID, persistent SEQUENCE and LAST-MODIFIED values, UTC start time, location, and cancellation status. Unknown kickoff times produce an all-day entry rather than inventing a time. Known kickoff times include a planned UTC end time when a supported KNVB duration can be resolved. Each match exposes nullable `duration_minutes`. Scores are included when published. Renames and rescheduling update the existing event, and expiring logo signatures do not increment revisions. Calendar text uses RFC 5545 escaping, CRLF line endings, and UTF-8-safe folding at 75 octets.

## Planned match duration

From theme 35.82.3, `TeamMatches::duration_minutes()` uses the linked union team's regular Sportlink competition metadata: age category, game type, gender and division. Local aliases inherit that union classification. Display names and team numbers are not used to guess age or match length.

The end time reserves playing time plus the maximum published halftime break and both pupil time-outs:

| Category | Playing time | Breaks | Calendar duration |
| --- | --- | --- | --- |
| O8–O9 | 40 minutes | 10 + 2 × 2 minutes | 54 minutes |
| O10 | 50 minutes | 10 + 2 × 2 minutes | 64 minutes |
| O11–O12, including MO11 | 60 minutes | 15 + 2 × 2 minutes | 79 minutes |
| O13 / MO13 | 60 minutes | 15 minutes | 75 minutes |
| O14–O15 / MO15 | 70 minutes | 15 minutes | 85 minutes |
| O16–O17 / MO17 | 80 minutes | 15 minutes | 95 minutes |
| O19–O23 and seniors | 90 minutes | 15 minutes | 105 minutes |

O13 divisions 1–2, O15 divisions 1–3 and O17 divisions 1–3 add ten minutes of playing time. These division exceptions do not apply to girls' competitions. The reviewed KNVB 2026/27 sources are [O8–O10](https://www.knvb.nl/downloads/sites/bestand/knvb/12343/infographic-6-tegen-6), [O11–O12](https://www.knvb.nl/downloads/sites/bestand/knvb/14647/infographic-8-tegen-8), [O13](https://www.knvb.nl/downloads/sites/bestand/knvb/30089/infographic-wedstrijdvorm-o13-11x11-vernieuwde-spelregels), [O14](https://www.knvb.nl/downloads/sites/bestand/knvb/30091/infographic-wedstrijdvorm-o14-cata-11x11), [O15 and older](https://www.knvb.nl/downloads/sites/bestand/knvb/28869/infographic-11x11), and [girls O15–O20](https://www.knvb.nl/downloads/sites/bestand/knvb/30093/infographic-wedstrijdvorm-mo15-mo17-mo20-11x11). Review these rules when KNVB changes its match formats.

This is a planning estimate: cup/friendly fixtures use the team's regular duration; locally agreed shorter halves, stoppage time, extra time and penalties are not included. The event description states that limitation. O7 activities, tournaments, 7x7, 9x9, walking football, futsal, unlinked local teams and ambiguous/unknown classifications retain no inferred end time and explicitly report that their duration is unknown. Unknown kickoff times and provisional days remain all-day entries.

The cache duration version triggers a refresh of legacy caches without discarding fixture history. Adding or changing the duration increments each affected event's `SEQUENCE` and updates `LAST-MODIFIED`, while preserving its UID. Retained historical fixtures and cancellation tombstones also gain a duration during the initial migration. Unchanged refreshes keep the same revision; source outages preserve the existing feed and backoff. Calendar applications decide when to refresh subscriptions, so existing phone entries can lag behind the corrected feed.

## Provisional KNVB matchdays

Team subscriptions include all-day provisional events from the [KNVB Oost 2026/27 calendar](https://www.knvb.nl/downloads/sites/bestand/knvb/29862/speeldagenkalender-veld-oost-2026-2027) when no active fixture exists on the reserved date. Titles identify the team, the kind of day (for example **Speeldag - Fase 2**, **Beker poule**, **Inhaal / beker**, or **Toernooi 7x7**) and **(voorlopig)**. Descriptions retain the original KNVB cell text and source URL. Pure **Vrij** cells and empty cells do not create events. Catch-up, cup, playoff and Final League reservations do not imply qualification or a confirmed match.

`KnvbMatchdays` selects the column using the resolved union team's regular Sportlink competition, age, class and playing day. Local aliases use their linked union team. Senior category A pools require a verified 12- or 14-team `poulestand`; the pool size is cached for a day. National competitions, unlinked local teams, futsal, unsupported schedules and ambiguous mappings receive no district placeholders. AWC 1 zondag and O23-1 use national calendars and are outside this dataset. The dataset applies only to district Oost and season 2026/27; it must be reviewed/replaced for a subsequent season or another district.

The reviewed source snapshot is `includes/data/knvb-oost-2026-2027.json`. Weekend dates use the team's Saturday or Sunday. Explicit Easter dates are retained, Sunday category A senior teams use Whit Monday rather than Whit Sunday, and midweek windows stay multi-day events. Friday 7x7 uses the ten separately printed Friday dates. The source's contradictory annotation **1 mei 2026: Bekerfinale stand.teams** within the May 2027 row is not converted into a speculative final; the unambiguous **Inhaal** cells are retained.

The existing `_rondo_team_matches_cache` stores `matchdays` separately from actual matches. The authenticated overview also returns this collection, but the match table continues to show only fixtures. Only future/today placeholders are introduced; already emitted events retain their UID, revision and modification time. When a real non-cancelled match appears on a reserved date (or anywhere in a midweek window), the old placeholder is emitted as `STATUS:CANCELLED` with a higher `SEQUENCE`. A later cancellation or move of that match can restore the placeholder using the same UID. Source outages preserve the last-known-good fixtures and placeholders. Provisional events use `STATUS:TENTATIVE`, `TRANSP:TRANSPARENT` and an exclusive all-day `DTEND`; no kickoff time is invented.

## Calendar tests

`KnvbMatchdaysTest` covers supported and unsupported competition mappings, season boundaries, cup and catch-up labels, holidays, Friday tournaments, midweek windows, and the placeholder cancellation/reinstatement lifecycle. `TeamMatchesTest` also exercises cached placeholders through fixture publication and a Sportlink outage.

`vendor/bin/codecept run Wpunit TeamMatchesTest` covers team/day disambiguation, local match inclusion, season filtering, result merging, outage retention, cancellation tombstones, event revisions, Unicode folding, unknown times, signed subscription permissions, KNVB age/division durations, legacy subscription migration, stable revisions and end times across daylight-saving changes.

`ParentRelationshipRestTest` covers household team scope, date boundaries, duplicate roles, excluded entities, and the restricted other-parent payload.
