---
title: "People Pipeline"
---

Syncs member data from Sportlink Club to Laposta email marketing lists and Rondo Club, including photos.

## Schedule

Runs **4x daily** at 8:00, 11:00, 14:00, and 17:00 (Amsterdam time).

```bash
scripts/sync.sh people          # Production (with locking + email report)
node pipelines/sync-people.js --verbose   # Direct execution (verbose)
```

## Pipeline Flow

```
pipelines/sync-people.js
├── Step 1: steps/download-data-from-sportlink.js    → data/laposta-sync.sqlite, data/rondo-sync.sqlite
├── Step 1b: steps/download-inactive-members.js      → deceased-member safety input
├── Step 2: steps/prepare-laposta-members.js         → data/laposta-sync.sqlite (members table)
├── Step 3: steps/submit-laposta-list.js             → Laposta API
├── Step 3b: steps/sync-deceased-members.js          → Laposta unsubscribe reconciliation
├── Step 4: steps/submit-rondo-club-sync.js          → Rondo Club API (members + parents + birthdate)
├── Step 4b: steps/sync-deceased-members.js          → Rondo Club death dates
├── Step 5: steps/download-photos-from-api.js        → photos/ directory
└── Step 6: steps/upload-photos-to-rondo-club.js     → Rondo Club API (media)
```

## Step-by-Step Details

### Step 1: Download from Sportlink

**Script:** `steps/download-data-from-sportlink.js`
**Function:** `runDownload({ logger, verbose })`

1. Launches headless Chromium via Playwright
2. Logs into `https://club.sportlink.com/` using `lib/sportlink-login.js`
3. Handles TOTP 2FA with `lib/totp.js`
4. Calls Sportlink `SearchMembers` API to get all members
5. Calls `MemberHeader` API for each member (photo URLs, financial block status)
6. Stores raw JSON results in `data/laposta-sync.sqlite` → `sportlink_runs` table
7. Upserts member data into `data/rondo-sync.sqlite` → `rondo_club_members` table

**Output:** `{ success, memberCount }`

**Databases written:**
- `data/laposta-sync.sqlite`: `sportlink_runs` (full JSON dump)
- `data/rondo-sync.sqlite`: `rondo_club_members` (per-member data with `source_hash`)

The same authenticated browser session also runs an inactive-member search. This is intentionally
separate from the active-member import: former members are not re-imported, but their
`DateOfPassing` remains visible for death-date reconciliation.

### Step 2: Prepare Laposta Members

**Script:** `steps/prepare-laposta-members.js`
**Function:** `runPrepare({ logger, verbose })`

1. Reads latest Sportlink results from `data/laposta-sync.sqlite` → `sportlink_runs`
2. Applies field mappings from `config/field-mapping.json` to transform Sportlink fields to Laposta custom fields
3. Reads the current-season obligation units from `GET /rondo/v1/volunteer-obligations`
4. Maps each Rondo person ID to its tracked KNVB ID or standalone-parent email and adds the numeric `vrijwilligersplicht` field
5. Handles parent extraction: creates separate list entries for `EmailAddressParent1` / `EmailAddressParent2`
6. Deduplicates parent entries across lists
7. Computes `source_hash` for each member (SHA-256 of email + custom fields)
8. Upserts into `data/laposta-sync.sqlite` → `members` table

**Output:** `{ success, lists: [{ total }], excluded }`

**Key transformations** (configured in `config/field-mapping.json`):
- `GenderCode`: "Male" → "M", "Female" → "V"
- `UnionTeams`: comma-separated team list
- Parent entries: creates person entries with `oudervan` (child names) field
- `vrijwilligersplicht`: `-1` when exempt or not applicable, `0` when completed, otherwise the summed number of duties still to complete

### Step 3: Submit to Laposta

**Script:** `steps/submit-laposta-list.js`
**Function:** `runSubmit({ logger, verbose, force })`

1. Reads members from `data/laposta-sync.sqlite` where `source_hash != last_synced_hash`
2. For each changed member, calls Laposta API:
   - **New member** (no existing Laposta record): `POST /api/v2/member`
   - **Updated member**: `POST /api/v2/member` with update
3. Updates `last_synced_hash` on success
4. Rate limited: 2s delay between API calls

**Output:** `{ lists: [{ index, listId, total, synced, added, updated, errors }] }`

**CLI flags:**
- `--force`: Sync all members regardless of hash (ignores change detection)

After the normal desired-state submission, `sync-deceased-members.js` checks active Laposta
relations whose address belongs to a deceased person. It changes those relations to
`unsubscribed`; it never deletes them. An address remains active when the freshly prepared local
list still needs that same address for another, living relation. Parent email fields are not
treated as the deceased person's own address.

### Step 4: Sync to Rondo Club

**Script:** `steps/submit-rondo-club-sync.js`
**Function:** `runSync({ logger, verbose, force })`

1. Reads members from `data/rondo-sync.sqlite` where `source_hash != last_synced_hash`
2. Reads free fields from `sportlink_member_free_fields` table (FreeScout ID, VOG date, financial block)
3. Builds WordPress API payload with ACF fields (see field mappings below)
4. For each changed member:
   - Before creating an untracked member, checks whether the same person already exists as a standalone parent. The parent post is reused only for one exact email plus normalized full-name match, when the incoming KNVB ID is not one of that parent's known children and the post is not already mapped to another member. Ambiguous matches block creation and surface an error instead of creating a duplicate.
   - **No `rondo_club_id`**: `POST /wp/v2/people` (create new person)
   - **Has `rondo_club_id`**: `PUT /wp/v2/people/{rondo_club_id}` (update existing)
5. Stores returned WordPress post ID as `rondo_club_id`
6. Updates `last_synced_hash` on success
7. If a tracked WordPress ID was merged away, resolves `/rondo/v1/people/{id}/merge-target`, stores the surviving ID, and continues the update there instead of recreating the member
8. Then processes **parent members** (from `rondo_club_parents` table):
   - Identified by email (no KNVB ID)
   - Linked to children via ACF `relationships` field
   - Deduplicated across multiple children's parent fields
   - Exact email matching considers published and trashed people. Known children and siblings are excluded; when the remaining parent match is in trash, the existing person is restored before relationships are synchronized. A new parent is created only when no valid existing match remains.
   - Historical parent mappings that point to one of the known children are forced through synchronization even when their source hash is unchanged. The invalid mapping is cleared before parent discovery runs, preventing a child from being written back as a parent of its siblings.
   - Existing members, contacts, and sponsors can also be linked as parents. Active members, contacts, and sponsors keep their managed name and contact fields. A former member who is still a current parent keeps the historical identity and membership fields, while current parent contact and address data is refreshed from the child's Sportlink data. Standalone parent profiles continue to receive their full name and contact profile from Sportlink.

**Output:** `{ total, synced, created, updated, skipped, errors, parents: { ... } }`

**Important:** `first_name` and `last_name` are required on every PUT request, even for partial ACF updates.

**Birthday field:** As of v2.3, birthdate is synced as `acf.birthdate` (YYYY-MM-DD) on the person record during Step 4. Previous versions used a separate `important_date` post type which is now deprecated.

After the regular active-member sync, the inactive snapshot is matched only against KNVB IDs that
already have a tracked Rondo person ID. `DateOfPassing` is written to the canonical
`datum_overlijden` field. This pass does not create people and does not refresh former-member
contact or profile fields. A successfully verified date is stored in `date_of_passing`, so repeat
runs are idempotent and a later Sportlink correction can be reconciled safely.

### Step 5: Photo Download

**Script:** `steps/download-photos-from-api.js`
**Function:** `runPhotoDownload({ logger, verbose })`

1. Queries `rondo_club_members` for members with `photo_state = 'pending_download'`
2. If none pending, returns early (no browser launched)
3. Launches headless Chromium via Playwright
4. Logs into Sportlink Club
5. For each pending member: navigates to `/member/member-details/{knvbId}/other`, captures `MemberHeader` API response
6. Extracts signed photo URL via `parseMemberHeaderResponse()` from `lib/photo-utils.js`
7. Downloads photo from CDN URL via `downloadPhotoFromUrl()` from `lib/photo-utils.js`
8. Saves to `photos/{knvb_id}.{ext}`
9. Updates `photo_state` to `'downloaded'`
10. Rate limited: 500ms-1.5s random jitter between members

**Output:** `{ success, total, downloaded, failed, errors }`

### Step 6: Photo Upload

**Script:** `steps/upload-photos-to-rondo-club.js`
**Function:** `runPhotoSync({ logger, verbose })`

1. Queries `rondo_club_members` for `photo_state = 'downloaded'` or `'pending_upload'`
2. Uploads each photo to `POST /wp-json/rondo/v1/people/{rondo_club_id}/photo` (multipart form-data)
3. Updates `photo_state` to `'synced'` on success
4. Also handles photo **deletion**: members with `photo_state = 'pending_delete'` get their Rondo Club photo removed
5. Rate limited: 2s between uploads/deletes

**Output:** `{ upload: { synced, skipped, errors }, delete: { deleted, errors } }`

### Step 7: Reverse Sync (Currently Disabled)

**Script:** `lib/reverse-sync-sportlink.js`
**Function:** `runReverseSync({ logger, verbose })`

Detects field changes made in Rondo Club and pushes them back to Sportlink via browser automation. Syncs contact fields (email, phone, mobile), home address fields, and administrative fields (VOG date, FreeScout ID, financial block).

## Field Mappings

### Sportlink → Laposta

See `config/field-mapping.json` for the complete mapping. Key fields:

| Laposta Field | Sportlink Source |
|---|---|
| *(email)* | `Email` |
| `voornaam` | `FirstName` |
| `tussenvoegsel` | `Infix` |
| `achternaam` | `LastName` |
| `geboortedatum` | `DateOfBirth` |
| `team` | `UnionTeams` |
| `geslacht` | `GenderCode` (Male→M, Female→V) |
| `relatiecode` | `PublicPersonId` (KNVB ID) |
| `vrijwilligersplicht` | Derived current-season Rondo obligation (`-1`, `0`, or a positive integer) |

### Sportlink → Rondo Club Members

| Rondo Club ACF Field | Source |
|---|---|
| `first_name` | `FirstName` |
| `infix` | `Infix` (lowercased tussenvoegsel) |
| `last_name` | `LastName` |
| `knvb-id` | `PublicPersonId` |
| `gender` | `GenderCode` (Male→male, Female→female) |
| `birth_year` | Year from `DateOfBirth` |
| `birthdate` | `DateOfBirth` (YYYY-MM-DD format, v2.3+) |
| `datum_overlijden` | `DateOfPassing` from the inactive-member safety pass |
| `contact_info` (repeater) | `Email`, `Mobile`, `Telephone` |
| `addresses` (repeater) | `StreetName` + `AddressNumber`, `ZipCode`, `City` |
| `lid-sinds` | `MemberSince` |
| `leeftijdsgroep` | `AgeClassDescription`; for Onder 6 through Onder 19, a missing or contradictory value is derived from `DateOfBirth` and the KNVB season boundary on 1 July |
| `spelactiviteit` | `KernelGameActivities`; always included, with `null` clearing the previous value when an active member stops playing |
| `type-lid` | `TypeOfMemberDescription` |
| `freescout-id` | From `sportlink_member_free_fields.freescout_id` |
| `datum-vog` | From `sportlink_member_free_fields.vog_datum` |
| `financiele-blokkade` | From `sportlink_member_free_fields.has_financial_block` |
| `wacht_op_overschrijving` | `true` when `Tooltip` contains "overschrijving" (case-insensitive). Sportlink markeert overgeschreven leden van een andere club met de tooltip "Actie van een ander (overschrijving)" totdat de KNVB-overschrijving verwerkt is. Het veld wordt altijd weggeschreven (ook `false`), zodat de badge automatisch verdwijnt zodra Sportlink de tooltip weghaalt. |

Youth age-class corrections are logged with the KNVB ID, Sportlink value, derived value, and birthdate. The fallback is intentionally limited to Onder 6 through Onder 19; adult and special categories remain fully owned by Sportlink.

## Database Tables Used

| Database | Table | Usage |
|---|---|---|
| `laposta-sync.sqlite` | `sportlink_runs` | Raw download results |
| `laposta-sync.sqlite` | `members` | Prepared Laposta members with hashes |
| `laposta-sync.sqlite` | `laposta_fields` | Cached field definitions |
| `rondo-sync.sqlite` | `rondo_club_members` | Member → WordPress ID mapping + hashes |
| `rondo-sync.sqlite` | `rondo_club_parents` | Parent → WordPress ID mapping |
| `rondo-sync.sqlite` | `sportlink_member_free_fields` | Free fields (read by Step 4) |

## CLI Flags

| Flag | Effect |
|------|--------|
| `--verbose` | Detailed per-member logging |
| `--force` | Skip change detection, sync all members |

## Error Handling

- Each step runs in a try/catch; failures are logged but don't stop the pipeline
- Rondo Club sync failure is non-critical (Laposta sync still completes)
- Photo download/upload failures are non-critical
- All errors are collected and included in the email summary report
- Exit code 1 if any errors occurred

## Source Files

| File | Purpose |
|------|---------|
| `pipelines/sync-people.js` | Pipeline orchestrator |
| `steps/download-data-from-sportlink.js` | Sportlink browser automation |
| `steps/prepare-laposta-members.js` | Field transformation for Laposta |
| `steps/submit-laposta-list.js` | Laposta API sync |
| `steps/download-inactive-members.js` | Focused inactive-member Sportlink search |
| `steps/sync-deceased-members.js` | Death-date and safe Laposta unsubscribe reconciliation |
| `steps/submit-rondo-club-sync.js` | Rondo Club API sync (members + parents + birthdate) |
| `steps/prepare-rondo-club-members.js` | Rondo Club member data preparation |
| `steps/prepare-rondo-club-parents.js` | Parent extraction and dedup |
| `steps/download-photos-from-api.js` | Photo download (Playwright) |
| `steps/upload-photos-to-rondo-club.js` | Photo upload/delete |
| `lib/photo-utils.js` | Shared photo helpers (MIME types, download, MemberHeader parsing) |
| `config/field-mapping.json` | Laposta field mapping config |
| `lib/laposta-db.js` | Laposta SQLite operations |
| `lib/rondo-club-db.js` | Rondo Club SQLite operations |
| `lib/rondo-club-client.js` | Rondo Club HTTP client |
| `lib/volunteer-obligation-sync.js` | Converts Rondo obligation units to Laposta recipient values |
| `lib/laposta-client.js` | Laposta HTTP client |
| `lib/sportlink-login.js` | Sportlink authentication |
