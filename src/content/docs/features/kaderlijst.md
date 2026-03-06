---
title: Kaderlijst (Trainer Layout)
---

The Kaderlijst feature provides a live roster sheet for youth staff roles, replacing static coordinator/trainer spreadsheets.

## Route and UI

- Route: `/kaderlijst`
- Navigation: `Teams -> Kaderlijst`
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

## Data sources

The page combines three existing endpoints:

- `GET /wp-json/wp/v2/teams` (all teams with parent hierarchy)
- `GET /wp-json/rondo/v1/teams/{team_id}/people` (active role assignments per team)
- `GET /wp-json/wp/v2/people` (contact details for mobile/email enrichment)

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
