---
title: Kaderlijst (Trainer Layout)
---

The Kaderlijst feature provides a live roster sheet for youth staff roles, replacing static coordinator/trainer spreadsheets.

## Route and UI

- Route: `/kaderlijst`
- Navigation: `Teams -> Kaderlijst` for general kader accounts; a standalone `Kaderlijst` item for
  accounts with only the dedicated capability.
- UI: shared `DataTable` component

Columns:

- `leeftijdsgroep`
- `jaargroep`
- `team`
- `voornaam`
- `achternaam` (`infix + last_name`)
- `rol`
- `mobiel`
- `email`

For readability, repeated values in `leeftijdsgroep`, `jaargroep`, and `team` are hidden on consecutive rows.

## Data sources and access scope

The page combines two data sources:

- `GET /wp-json/wp/v2/teams` for team names and parent hierarchy.
- `GET /wp-json/rondo/v1/kaderlijst/people` for the scoped kader records and contact fields.

The Kaderlijst endpoint is the security boundary. It returns only the canonical fields rendered by
the table: names, work history, email addresses, mobile numbers, and telephone numbers. It applies
the current user's person scope before building the response:

- the dedicated `kaderlijst` capability receives all active kader records without widening general
  person visibility;
- management capabilities receive all active kader records;
- coordinators receive kader linked to teams whose current player roster matches one of their
  permitted age groups;
- household-scoped members receive only their visible household IDs, with the normal member field
  allowlist still applied.

Do not replace this endpoint with an unscoped `wp/v2/people` request or a shared full-club snapshot.

The built-in `rondo_kaderlijst` role carries only the `kaderlijst` capability. It does not set
`is_kader`, does not unlock `/people`, `/teams`, or other staff routes, and is ignored when general
age-group person visibility is calculated. Map a Sportlink functie such as a tournament coordinator
to this role when the account needs the roster but not the member directory.

## Server cache

The scoped person response is stored in a WordPress transient for one day. Cache entries are shared
only when the complete visibility scope is identical:

- one shared key for unrestricted management users;
- one key per exact set of permitted age groups;
- one key per exact household person-ID set.

The transient key also contains the cache generation, current local date, and configured player-role
list. The date prevents an ended work-history row from surviving into the next day. Person and team
saves, native person-field writes, and person/team deletion advance the generation, which makes all
older scope caches unreachable while they expire naturally. This generation strategy also works
with a persistent WordPress object cache.

`GET /wp-json/rondo/v1/kaderlijst/people?refresh=true` bypasses and replaces the current scope's
cache. The **Kaderlijst verversen** button uses this parameter; it does not invalidate other scopes.

## Grouping and ordering

Grouping is derived from team naming and ancestry:

- `jaargroep` comes from a `JOxx` prefix in the team name (or nearest parent)
- `leeftijdsgroep` is inferred from the year:
  - `JO12` through `JO19` -> `Junioren`
  - `JO6` through `JO11` -> `Pupillen`
- If year inference is unavailable, parent labels containing `Junioren` or `Pupillen` are used as fallback

Display ordering:

- `Junioren` first, then `Pupillen`, then `Overig`
- Within each age group: higher `JO` first (older to younger)
- Then team and person name (natural alphanumeric sort)

## Filtering

The DataTable exposes filters for:

- `leeftijdsgroep` (select)
- `jaargroep` (select)
- `team`, `voornaam`, `achternaam`, `rol`, `mobiel`, `email` (text)

## Role semantics

People can appear multiple times in the list. Each row reflects the role in the context of that specific team/year/age-group assignment.
