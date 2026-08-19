---
title: "Functions Pipeline"
---

Scrapes committee and club-level function memberships from Sportlink, creates commissie posts in Rondo Club, and links members to commissies via work history. Also scrapes free fields (FreeScout ID, VOG date, financial block) used by the People pipeline.

## Schedule

Runs on **two schedules**:

| Mode | Schedule | Command | Members Processed |
|------|----------|---------|-------------------|
| Recent | 4x daily (7:30, 10:30, 13:30, 16:30) | `scripts/sync.sh functions` | Members with `LastUpdate` in last 2 days + VOG-filtered volunteers + one-quarter daily coverage |
| Full | Weekly Sunday 1:00 AM | `scripts/sync.sh functions --all` | All tracked members (~1000+) |

The recent sync runs 30 minutes before each People sync to ensure fresh free fields are available.

```bash
scripts/sync.sh functions           # Recent updates (production)
scripts/sync.sh functions --all     # Full sync (production)
node pipelines/sync-functions.js --verbose    # Recent (direct)
node pipelines/sync-functions.js --all --verbose  # Full (direct)
```

## Pipeline Flow

```
pipelines/sync-functions.js
├── Step 1: steps/download-functions-from-sportlink.js   → data/rondo-sync.sqlite
│   ├── Scrape /functions tab (committees, club functions)
│   └── Scrape /other tab (free fields: FreeScout ID, VOG, financial block, photo URL)
├── Step 2: steps/submit-rondo-club-commissies.js           → Rondo Club API (commissies)
└── Step 3: steps/submit-rondo-club-commissie-work-history.js → Rondo Club API (person work_history)
```

## Step-by-Step Details

### Step 1: Download Functions from Sportlink

**Script:** `steps/download-functions-from-sportlink.js`
**Function:** `runFunctionsDownload({ logger, verbose, withInvoice, recentOnly, days })`

1. Launches headless Chromium via Playwright
2. Logs into Sportlink Club
3. Determines which members to process:
   - **Recent mode** (`recentOnly: true`, default): Members with `LastUpdate` within the last N days (default 2), plus VOG-filtered volunteers from Rondo Club API and a deterministic quarter of all active members. The four scheduled runs cover every member once per day because Sportlink does not reliably update `LastUpdate` after a function or committee assignment changes.
   - **Full mode** (`recentOnly: false`, `--all` flag): All tracked members from `rondo_club_members`
4. For each member, scrapes two pages:
   - **`/functions` tab**: Extracts committee memberships and club-level functions
     - Committee name, role, start/end dates, active status
     - Club functions (e.g., "Voorzitter", "Secretaris")
   - **`/other` tab**: Extracts free fields via two Sportlink APIs:
     - `MemberFreeFields` API: `Remarks3` (FreeScout ID), `Remarks8` (VOG date)
     - `MemberHeader` API: `HasFinancialTransferBlockOwnClub`, `Photo.Url`, `Photo.PhotoDate`
5. Stores data in `data/rondo-sync.sqlite`:
   - `sportlink_member_functions`: Club-level functions per member
   - `sportlink_member_committees`: Committee memberships per member
   - `sportlink_member_free_fields`: Free fields per member
6. Stores each successful function and committee endpoint response as a complete per-member snapshot:
   - **Recent mode**: Replaces rows only for members whose endpoint returned successfully, including valid empty responses. Members outside the run and failed endpoints keep their previous rows.
   - **Full mode**: Clears the complete table only when that endpoint succeeded for every processed member. A partial run falls back to per-member replacement so failed responses cannot cause false removals.

**Output:** `{ success, total, functionsCount, committeesCount, errors }`

**Rate limiting:** 500ms-1.5s random jitter between member scrapes.

**Critical gotcha:** A successful empty response is authoritative and must remove that member's old rows. A missing, timed-out, non-2xx, or unparseable endpoint response is not a snapshot and must preserve the previous rows.

### Step 2: Sync Commissies to Rondo Club

**Script:** `steps/submit-rondo-club-commissies.js`
**Function:** `runSync({ logger, verbose, force, currentCommissieNames })`

1. Reads unique committee names from `sportlink_member_committees`
2. Creates a synthetic "Verenigingsbreed" commissie for club-level functions (not tied to a specific committee)
3. For each commissie where `source_hash != last_synced_hash`:
   - **No `rondo_club_id`**: `POST /wp/v2/commissies` (create new)
   - **Has `rondo_club_id`**: `PUT /wp/v2/commissies/{rondo_club_id}` (update)
4. Detects orphan commissies (in DB but not in current Sportlink data) and removes them
5. Updates `last_synced_hash` on success

The WordPress collection reader follows the `X-WP-TotalPages` response header and also stops on a partial page. It must not probe one page beyond the collection and use WordPress's `rest_post_invalid_page_number` response as pagination control flow.

**Output:** `{ total, synced, created, updated, skipped, deleted, errors }`

### Step 3: Sync Commissie Work History

**Script:** `steps/submit-rondo-club-commissie-work-history.js`
**Function:** `runSync({ logger, verbose, force })`

1. Reads committee memberships from `sportlink_member_committees` joined with `rondo_club_commissies` and `rondo_club_members`
2. Also reads club functions from `sportlink_member_functions` (mapped to "Verenigingsbreed" commissie)
3. Compares against `rondo_club_commissie_work_history`, including tracked roles that no longer exist in the current Sportlink snapshot
4. For each member with changes:
   - Fetches current `work_history` ACF repeater from Rondo Club
   - Adds new commissie assignments
   - Ends removed assignments (sets `is_current: false`), using Sportlink's `relation_end` when present and the detection date otherwise
   - Only modifies sync-created entries (manual entries preserved)
5. Sends `PUT /wp/v2/people/{rondo_club_id}` with updated `work_history`
6. Updates or removes local tracking only after the Rondo write succeeds, so failed writes remain queued for retry
7. Skips members without a `rondo_club_id`

**Output:** `{ total, synced, created, ended, skipped, errors }`

## Field Mappings

### Sportlink → Rondo Club Commissies

| Rondo Club Field | Source | Notes |
|---|---|---|
| `title` | Committee name | Post title |
| `status` | Hardcoded `publish` | Always published |

### Sportlink → Rondo Club Commissie Work History

| Repeater Field | Source | Notes |
|---|---|---|
| `team` | `rondo_club_commissies.rondo_club_id` | WordPress post ID of the commissie |
| `job_title` | `role_name` or "Lid" (fallback) | Role within committee |
| `is_current` | `is_active` from Sportlink | Based on `RelationEnd` and `Status` |
| `start_date` | `relation_start` | Normalized to YYYY-MM-DD |
| `end_date` | `relation_end` | Empty if current |

### Free Fields (Used by People Pipeline)

These are scraped during the functions pipeline but consumed by the People pipeline:

| Sportlink API | Sportlink Field | SQLite Column | Rondo Club ACF Field |
|---|---|---|---|
| `MemberFreeFields` | `Remarks3.Value` | `freescout_id` | `freescout-id` |
| `MemberFreeFields` | `Remarks8.Value` | `vog_datum` | `datum-vog` |
| `MemberHeader` | `HasFinancialTransferBlockOwnClub` | `has_financial_block` | `financiele-blokkade` |

Note: `MemberHeader` also returns `Photo.Url` and `Photo.PhotoDate`, which are stored in `sportlink_member_free_fields` but photo downloading is handled by the People pipeline (Step 5), not the Functions pipeline.

## Database Tables Used

| Database | Table | Usage |
|---|---|---|
| `rondo-sync.sqlite` | `sportlink_member_functions` | Club-level functions per member |
| `rondo-sync.sqlite` | `sportlink_member_committees` | Committee memberships per member |
| `rondo-sync.sqlite` | `sportlink_member_free_fields` | Free fields (FreeScout ID, VOG, etc.) |
| `rondo-sync.sqlite` | `rondo_club_commissies` | Commissie → WordPress ID mapping |
| `rondo-sync.sqlite` | `rondo_club_commissie_work_history` | Tracks sync-created work history entries |
| `rondo-sync.sqlite` | `rondo_club_members` | KNVB ID → Rondo Club ID lookup |

## CLI Flags

| Flag | Effect |
|------|--------|
| `--verbose` | Detailed per-member logging |
| `--force` | Skip change detection |
| `--all` | Full sync (all members instead of recent only) |
| `--days N` | Override LastUpdate window (default: 2 days) |
| `--with-invoice` | Also scrape invoice data from /financial tab |

## Error Handling

- Individual member scrape failures don't stop the pipeline (error logged, previous function/committee snapshot preserved)
- Commissie sync failures don't prevent work history sync
- Failed Rondo work-history writes retain their tracking state and retry on the next run
- Members without a `rondo_club_id` are skipped for work history
- All errors collected in summary report

## Source Files

| File | Purpose |
|------|---------|
| `pipelines/sync-functions.js` | Pipeline orchestrator |
| `steps/download-functions-from-sportlink.js` | Sportlink function/committee scraping (Playwright) |
| `steps/submit-rondo-club-commissies.js` | Rondo Club commissie API sync |
| `steps/submit-rondo-club-commissie-work-history.js` | Rondo Club commissie work history sync |
| `lib/rondo-club-db.js` | SQLite operations |
| `lib/rondo-club-client.js` | Rondo Club HTTP client |
| `lib/sportlink-login.js` | Sportlink authentication |
