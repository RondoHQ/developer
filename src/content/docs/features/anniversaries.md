---
title: Anniversaries (Jubilarissen)
---

The Anniversaries feature tracks upcoming member and volunteer jubilees based on `lid-sinds` on `person` posts.

## Scope (phase 1)

- Calculates upcoming milestones for active members (former members are excluded)
- Supports Dutch half-year milestones (for example `12.5` years)
- Exposes jubilees in the dashboard payload
- Adds configurable milestone settings

## Data source

- `person` post meta: `lid-sinds` (`Y-m-d`)
- `person` post meta: `huidig-vrijwilliger` (for volunteer jubilees)
- `person` ACF repeater: `work_history[].start_date` (oldest date is used for volunteer anniversary tenure)
- `person` post meta: `former_member` (excluded when true)

## REST API

### Get upcoming anniversaries

- `GET /wp-json/rondo/v1/anniversaries`
- Permission: approved logged-in users
- Query params:
  - `days_ahead` (default `365`, max `730`)
  - `days_back` (default `0`, max `730`)
  - `limit` (default `100`, max `500`)

Response item shape:

- `id`
- `type` (`member` or `volunteer`)
- `milestone_years` (number, supports `.5`)
- `milestone_label` (Dutch label, for example `12,5 jaar`)
- `title`
- `anniversary_date` (`Y-m-d`)
- `days_until`
- `person` (summary object)

### Get anniversary settings

- `GET /wp-json/rondo/v1/anniversaries/settings`
- Permission: admin

### Update anniversary settings

- `POST /wp-json/rondo/v1/anniversaries/settings`
- Permission: admin
- Body:

```json
{
  "milestones": {
    "member": [5, 10, 15, 20, 25, 40, 50, 60, 75],
    "volunteer": [12.5, 25, 40]
  }
}
```

## Options storage

Milestone settings are stored in the WordPress options table:

- `rondo_anniversary_milestones`

Defaults:

- `member`: `5, 10, 15, 20, 25, 40, 50, 60, 75`
- `volunteer`: `12.5, 25, 40`

## Dashboard integration

`GET /wp-json/rondo/v1/dashboard` now returns:

- `upcoming_anniversaries` (same item shape as the anniversaries endpoint)

The React dashboard renders this in a dedicated **Jubilarissen** card and supports show/hide/order in dashboard customization.

## Members page

A dedicated members subpage is available at:

- `Leden → Jubilarissen`
- route: `/people/jubilarissen`

Behavior:

- defaults to anniversaries in the next 6 months
- supports selecting period via dropdown:
  - coming: 3, 6, 9, 12 months
  - past: 6, 12, 18 months
- supports filtering between:
  - all anniversaries
  - member anniversaries
  - volunteer anniversaries

## Settings UI

Admins can manage anniversary milestones in:

- `Settings → Beheer → Jubilarissen`

The UI supports:

- toggling default milestone sets for members and volunteers
- adding custom milestones
- removing custom milestones
- rendering custom milestones as regular grid tiles (same style as built-ins) with a checked checkbox on the left
- unchecking a custom milestone removes it

Validation rules in UI and API:

- values must be between `0` and `120`
- only full years or half years are accepted (for example `25`, `12.5`)
