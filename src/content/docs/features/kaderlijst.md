---
title: Kaderlijst (Trainer Layout)
---

The Kaderlijst feature provides a live roster sheet for youth staff roles, replacing static coordinator/trainer spreadsheets.

## Route and UI

- Route: `/kaderlijst`
- Navigation: `Voetbal -> Kaderlijst`, independent of the Teams overview.
- UI: shared `DataTable` component

Columns:

- `team`
- `naam` (`first_name + infix + last_name`)
- `rol`
- `mobiel`
- `email`

The roster starts with Team; age group and year are available as filters only. The full-name column has a 180px target width, wraps long names, and sorts by last name, then first name. Spare width goes to the final email column so the name and role remain close together. Its text filter searches the complete name, including infixes.

For readability, repeated values in `team` are hidden on consecutive visible rows. A stronger horizontal border marks each new team or coordinator group. Team labels and separators are computed from the current filtered and sorted rows, so the first visible row always retains its context.

The shared `DataTable` passes `previousRow` (the previous visible original record, or `undefined`) to cell renderers and as the third argument of `rowClassName(row, index, previousRow)`.

Phone numbers are clickable `tel:` links with a separate WhatsApp icon beside them. WhatsApp links use `https://wa.me/` followed by the normalized international number with digits only. Email addresses remain clickable `mailto:` links.

## Data sources and access scope

The page uses `GET /wp-json/rondo/v1/kaderlijst/people`. Its `people` array contains the limited staff/contact fields; `teams` contains only `id`, `parent`, `name`, and `can_access` for published teams. A team name links to its detail page only when `can_access` is true. Team labels do not grant access to the team directory or roster.

The Kaderlijst endpoint is the security boundary. It returns only the canonical fields rendered by
the table: names, work history, email addresses, mobile numbers, and telephone numbers. It applies
the current user's person scope before building the response:

- the dedicated `kaderlijst` capability receives all active kader records without widening general
  person visibility;
- management capabilities receive all active kader records;
- coordinators receive the full club-wide kader roster, regardless of their assigned age groups or teams;
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

- one shared key for full-roster viewers, including coordinators, management, and the dedicated Kaderlijst role;
- one key per exact household person-ID set.

Team labels and per-user link permissions are added outside this shared people cache so one viewer never inherits another viewer's access.

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

The DataTable retains separate age-group and year filters through hidden, non-toggleable columns (`age_group_filter` and `year_group_filter`). Neither appears in the table or column picker.

The DataTable exposes filters for:

- `leeftijdsgroep` (select)
- `jaargroep` (select)
- `team`, `naam`, `rol`, `mobiel`, `email` (text)

## Role semantics

People can appear multiple times in the list. Each row reflects the role in the context of that specific team/year/age-group assignment.

The roster renders each combination of person ID, team ID and normalized display role once. Multiple current work-history entries with different start dates can describe the same assignment; those entries share one roster row. Distinct roles and assignments at different teams remain separate, and stored work history is preserved.
