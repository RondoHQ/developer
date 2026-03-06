---
title: Demo Data Pipeline
---

Documentation for the demo data export/import system.

## Overview

The demo data pipeline anonymizes production data into a portable JSON fixture, enabling realistic demo environments that always look "fresh."

## Export

Run on the production server:

```bash
wp rondo demo export
```

Creates `fixtures/demo-fixture.json` in the theme directory with:
- All people (anonymized names, addresses, phones, emails)
- All teams and commissies (names preserved)
- Discipline cases, tasks, activities, notes
- Settings:
  - Fee categories, role config, family discount config
  - Anniversary milestone config for Jubilarissen (`rondo_anniversary_milestones`)
  - Finance config used by invoices/finance dashboard (`rondo_finance_*`, anonymized/placeholders)
  - Membership pass wallet config (`rondo_membership_pass_*`, portable non-secret values only)

## Import

Run on the target site:

```bash
wp rondo demo import           # Import alongside existing data
wp rondo demo import --clean   # Wipe existing data first, then import
```

Default fixture path: `fixtures/demo-fixture.json` in the theme directory.

### Date Shifting

All dates in the fixture are shifted relative to today on import:
- Birthdates maintain the person's age (full-year shift)
- Activity/note dates are shifted to appear recent
- Season references are shifted to current/recent seasons
- Leap year dates (Feb 29) become Feb 28 in non-leap years

### Demo Site Banner

Sites with the `rondo_is_demo_site` WordPress option set to `1` display a yellow banner reading "DEMO OMGEVING — Dit is geen echte data" at the top of every page.

Set via WP-CLI:

```bash
wp option update rondo_is_demo_site 1
```

## Fixture Format

The fixture is a self-contained JSON file with:
- `meta` — version, export date, record counts
- `people`, `teams`, `commissies` — entity arrays
- `discipline_cases`, `todos`, `comments` — related entities
- `settings` — WordPress options (fees/VOG, anniversaries milestones, finance config, membership pass config)
- `taxonomies` — relationship types, seizoenen

All cross-entity references use portable refs (`person:1`, `team:5`) resolved during import.
