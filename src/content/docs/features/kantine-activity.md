---
title: Kantine activity and matchday context
---

**Kassaomzet → Drukte & bezetting** combines hourly purchases, product revenue, registered kantine staffing and archived home fixtures. It defaults to yesterday's Amsterdam business day. Approved users need `kassaomzet` access; broader finance-management permission is not required.

## Hourly purchase contract

The [Twelve browser pipeline](/sync/pipeline-twelve/) optionally supplies `activity: { version: 1, transactions: [...] }` alongside `product_revenue`. Each transaction contains an original basket `id`, `localTime` (`YYYY-MM-DD HH:mm`, Europe/Amsterdam), `kind` (`sale` or `correction`) and `products: [{ name, cashCents, businessclubCents }]`. No customer or operator data is included.

`Activity::validate()` requires unique basket IDs, valid timestamps within the report's covered business day, nonempty product lists, known unique product names and integer cents. Summed basket allocations must exactly equal every daily product's cash and Businessclub allocations. Supplying invalid activity rejects the whole report import; omitting activity remains supported for older reports.

Each sale basket counts once, including split payments and zero-value sales. Classification comes from the existing product-group settings:

| Purchase group | Rule |
| --- | --- |
| `food` | Contains food, without drink or an unassigned product |
| `non_food` | Contains drink, without food or an unassigned product |
| `mixed` | Contains both food and drink |
| `unassigned` | Contains an unassigned product, taking precedence over other groups |
| `entree` | Only entrance products remain after exclusions |

Entrance products alongside food or drink do not change the purchase group. Merchandise and Overig are excluded. Revenue remains a separate partition by product group, combining cash and Businessclub cents including VAT. Corrections affect revenue and have a separate count; they never become new purchases. Top-ups, tab settlements and other no-sales do not become purchases.

The day runs 06:00–06:00. Each hourly row has `covered` and `complete` flags, purchase counts, revenue cents and correction count. Missing activity returns `hours: null`, rather than 24 zeroes. Partial hours can still change. Twelve timestamps lack UTC offsets, so the repeated autumn 02:00 hour is combined. Negative revenue stays visible in totals and details even though chart bars show only positive segments.

## Registered staffing

`Activity::staffing()` reads overlapping published `dienst_shift` records for the seeded `kantine_bar`, `kantine_keuken_prep` and `kantine_keuken_verkoop` types. Cancelled shifts are excluded. Assigned people are deduplicated at each instant, including across overlapping shifts; hourly `min` and `max` preserve staffing changes within the hour. `scheduled` distinguishes no shift from a scheduled shift with zero helpers. The API exposes counts without person IDs or names.

Staffing includes planned assignees and [retrospectively registered helpers](/features/volunteer-shifts/#retrospective-attendance). It is registered staffing, not a complete attendance measurement.

## Durable matchday archive

`MatchArchive` registers private `rondo_kantine_day` posts with daily snapshots in `_kantine_day`. The `rondo_kantine_match_config` option supplies `venue`, `first_team_ids` and `u23_team_ids`; team IDs are strings. It reuses the Sportlink matchday client's existing club configuration. Special-team identity uses those exact IDs, keeping the first Sunday team distinct from the Saturday first team even when both play on Saturday.

When the configuration exists, `rondo_kantine_match_archive` runs hourly. Its default refresh requests `programma`, `uitslagen` and `afgelastingen` for 21 days beginning one week before today, with up to 500 rows per feed. A failed request or a feed reaching that limit stops the refresh and preserves the archive. A 15-minute stale-lock recovery protects the `rondo_kantine_archive_lock` option.

Stable source fixture IDs deduplicate records and move rescheduled fixtures away from their old day. Past fixtures survive disappearance from later feeds. Future absent fixtures receive **Niet meer in programma** only after a fetch without invalid records. Malformed records are counted in `invalid_records`; usable fixtures are retained, while affected refresh days remain incomplete.

Only home fixtures at the configured venue without an exclusion reason count. Cancellations, other venues, away fixtures, unknown club/location and activities remain available with reasons. Training, internal games, recreational activities and blocking entries stay separate. Youth grouping recognizes O/0, JO and MO age labels below 23; O23 and older are seniors. Grouping is recalculated when reading older snapshots.

A complete day requires clean snapshots before the day, during it and after it ends. Historical results alone cannot reconstruct disappeared youth fixtures. Unknown club/location also makes the summary incomplete. An incomplete count is a lower bound; no archived fixtures does not establish zero matches. `first_home` and `u23_home` are `true` when a counted fixture exists, `false` only for a complete day without it, and otherwise `null`.

## Revenue comparison and API

The median uses at least five earlier complete reports from the preceding year, on the same weekday, with complete match archives, at most two home fixtures more or fewer, and equal first-team and O23 home status. Reports also need product allocations. Merchandise/Overig exclusions follow current settings. Missing match coverage yields `reason: incomplete_matches`; fewer than five usable days yields `too_few_days` and `median: null`. The view presents association, without claiming a causal effect.

`GET /wp-json/rondo/v1/twelve/activity?date=YYYY-MM-DD` requires a real calendar date and kassa access. It returns `date`, `hours`, `staffing`, daily euro `revenue`, `report_complete`, `coverage_end`, `matches` and `comparison`. Hourly revenue uses integer cents, while daily revenue and the median use euros.

Implementation: `class-twelve-activity.php`, `class-twelve-match-archive.php`, `class-rest-twelve-reports.php` and `KantineDrukte.jsx`. `TwelveActivityTest`, `TwelveBrowserImportTest` and `TwelveMatchArchiveTest` cover financial reconciliation, permissions, staffing overlap, retained history, rescheduling, malformed feeds and age grouping.
