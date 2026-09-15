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

## Additive member journey examples

To refresh member-facing examples on the existing demo without importing production data or replacing its records, run from the demo WordPress root:

```bash
wp eval-file wp-content/themes/rondo-club/bin/demo-feature-fixtures.php plan
wp eval-file wp-content/themes/rondo-club/bin/demo-feature-fixtures.php seed
```

The helper requires both the exact home URL `https://demo.rondo.club` and the `rondo_is_demo_site` flag. It refuses AWC and every other origin. The default action is the read-only plan.

The seed adds these fictional examples:

- Alex and Robin Voorbeeld with their two minor children, Noor and Sam, plus a volunteer and a former member.
- A youth team, a senior team, and a volunteer committee; the children play in the youth team and Alex has trainer and committee roles.
- Regular member-pass eligibility and a former member with an eligible sponsor-company contact, demonstrating the separate pass rules.
- Four volunteer shift types and 48 shifts: past completed duties, upcoming personal duties, open and full shifts, and cancelled examples.

All six people use reserved `.invalid` email addresses. The CLI helper suppresses WordPress email while seeding. It does not copy production records, Wallet signing credentials, payment credentials, or access tokens. Pass eligibility does not imply that Apple Wallet or Google Wallet issuance is configured on the demo.

Each generated post carries `_rondo_feature_demo_key`; generated IDs and the initial base date are recorded in the `rondo_feature_demo_state` option. Repeat runs update these marked examples and preserve their IDs and original demonstration period. They do not delete unrelated records. They can reset edits made to the marked examples, so use the helper deliberately. Dates do not roll forward automatically.

### Member and app-review accounts

Account setup is separate from fixture generation. Link a dedicated demo member account to the generated `people.parent` ID with `rondo_linked_person_id`; keep its role limited to `subscriber` and verify that it sees only Alex, Noor, and Sam. Existing shared demo accounts can use the same fictional household without changing their login details or roles.

Keep review passwords in private storage outside the document root and source control. Verify both authentication and the actual household, calendar, and pass screens before using an account for review. A working website account alone does not make it usable by a native app: the app must explicitly support the demo club and its authentication callback. The AWC-only pilot build requires a separate update for this.

Before updating the demo theme or seeding data, make private database and theme backups. The demo deploy wrapper is `bin/deploy-demo.sh`; the additive seed is an explicit follow-up step, not part of a normal web request or production deployment.
