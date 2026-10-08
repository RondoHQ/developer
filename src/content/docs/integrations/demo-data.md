---
title: Demo Data Pipeline
---

Documentation for the demo data export/import system.

## Overview

Rondo supports the legacy anonymized export/import pipeline and a separately generated fictional showcase. The version 1 export remains supported; the showcase uses the version 2 format described below.

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

A clean import preserves the completed membership-pass migration flag
`rondo_membership_pass_private_actions_v1_done`. This upgrade state belongs to
the installed code, so replacing demo data does not repeat the legacy public-pass
metadata cleanup. Other replaceable membership-pass configuration is still cleared.

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

## Fictional showcase (version 2)

`fixtures/demo-showcase.json` contains SV Voorbeeld: 214 people, twelve teams, eight committees and twenty linked workflow scenarios. `bin/generate-demo-showcase.py` reproducibly generates it using Python 3 and PHP; it does not read production. The fixture includes no real contact addresses, bank accounts, provider credentials or payment links.

The graph covers households and former members, VOG/IVA, volunteer shifts, fees and installments, discipline, tasks and feedback, anniversaries, sponsors, training and park closures, rooms, tournaments, newsletters, Club TV, admissions, passes, clothing, canteen revenue/costs, match compensation and onboarding. Twelve teams each have sixteen `Teamspeler` roles; separate trainer and team-leader roles keep roster counts meaningful. One household has three siblings sharing an address. Programmes alternate home and away using the canonical `home` flag, include results and a cancellation, and use local season-valid caches. Tournament examples include open/submitted entries, an unpaid invoice and a manually paid entry.

### Validation and first import

Run these commands only on a demo site with `rondo_is_demo_site` enabled, after deploying the supporting theme. From the WordPress directory, validate without writes:

```bash
wp rondo demo import --input=wp-content/themes/rondo-club/fixtures/demo-showcase.json --dry-run
```

After approving replacement and making a private database backup, the first import requires `--clean`:

```bash
wp rondo demo import --input=wp-content/themes/rondo-club/fixtures/demo-showcase.json --clean
```

The complete fixture is validated before cleanup: version/source, unique references, supported post types/statuses/taxonomies, native field contracts, relative dates, allowed settings and account permissions. IDs are allocated before fields and cross-record references are resolved. Domain data uses `Fields` and the registry formatter; internal read-only scalar state uses native post meta. Dates resolve relative to import day in the WordPress timezone; `{season}` follows the July-to-June season. `$ref`, `$date`, `$json`, `$user: demo` and embedded `{{type:ref}}` markers keep the JSON portable.

A clean import replaces Rondo records and configuration, including payment-provider settings, while preserving WordPress accounts and completed migrations. Module deletion runs in batches of 100. Native relationship and shift deletion guards remain active: a protected record stops cleanup before record deletion. A plain `--dry-run` validates the fixture; it does not prove that existing records can be deleted.

### Refresh an existing showcase

Use `--refresh` to replace records owned by `rondo_demo_showcase_manifest`, preserving unrelated posts, media, comments and taxonomy terms:

```bash
wp rondo demo import --input=wp-content/themes/rondo-club/fixtures/demo-showcase.json --refresh --dry-run
wp rondo demo import --input=wp-content/themes/rondo-club/fixtures/demo-showcase.json --refresh
```

`--refresh` requires version 2, demo mode and an existing valid manifest; it cannot be combined with `--clean`. Validation checks positive integer IDs, expected post types and bundled-logo ownership, ignores term IDs as post identities, and rejects any owned person's relationship to an existing person outside the manifest. During refresh, owned relationship and shift-assignment fields are cleared through the native field layer before deletion guards run. Other guards remain active; a protected cancellation can stop refresh after those field clears, so retain the backup and inspect the state before retrying. A refresh dry run validates fixture and manifest without performing these clears.

Refresh also resets demo configuration, including provider credentials, before importing the replacement settings. Record IDs change; use the replacement manifest's `refs` map, not an old numeric ID. The manifest records `imported_at`, `refs` and feature `coverage`.

### Demo identity, logos and provider limits

The importer links the existing `demo` login to Anna Bos and adds `rondo_bestuur`, `rondo_kaderlijst`, and the explicit training, narrowcasting, match-registration, football-administration, feedback, committee and volunteer capabilities. It does not create that account or grant WordPress administrator access. Login credentials and completed migration flags survive replacement.

Five reviewed SVGs from `fixtures/demo-logos/` supply the club and four sponsor logos. Only these allowlisted files are imported; the temporary SVG MIME allowance is removed afterwards. Attachment dimensions, alt text and ownership markers support Club TV image rendering and scoped refresh.

`DemoProtection` blocks `wp_mail()` when both demo mode and the showcase manifest are present, returning an unsent result. Missing provider configuration remains visible. Sportlink sync, Laposta sending, checkout/refunds, Wallet provisioning, calendar providers, document review and physical players require separate test accounts or devices; local fixture records do not prove those integrations succeeded.

`tests/Wpunit/DemoShowcaseTest.php` covers native consumer contracts, permissions, logos, home/away fixtures, guarded cleanup and repeated refresh while retaining unrelated records.
