---
title: "FreeScout Pipeline"
---


Syncs only the minimum customer identity needed by FreeScout: first name, last name, and email address. Live member context is supplied by the Rondo Integration sidebar instead of being copied into FreeScout customer profiles. The pipeline also downloads FreeScout conversations and creates activities in Rondo Club.

## Schedule

Runs **daily** at 8:00 AM (Amsterdam time).

```bash
scripts/sync.sh freescout           # Production (with locking + email report)
node pipelines/sync-freescout.js --verbose    # Direct execution (verbose)
```

## Pipeline Flow

```
pipelines/sync-freescout.js
├── Check credentials (FREESCOUT_API_KEY + FREESCOUT_URL)
├── steps/submit-freescout-sync.js
│   ├── steps/prepare-freescout-customers.js   → data/freescout-sync.sqlite
│   └── Submit to FreeScout API          → FreeScout customers
└── Conversations pipeline
    ├── steps/download-freescout-conversations.js  → data/freescout-sync.sqlite
    ├── steps/prepare-freescout-conversations.js   → activity payloads
    └── steps/submit-freescout-activities.js       → Rondo Club activities
```

## Customer Sync

### Credential Check

Before running, `pipelines/sync-freescout.js` verifies that `FREESCOUT_API_KEY` and `FREESCOUT_URL` are configured in `.env`. If not, the pipeline exits with an error.

### Customer Preparation

**Script:** `steps/prepare-freescout-customers.js` (called internally by `steps/submit-freescout-sync.js`)

1. Reads member data from `data/rondo-sync.sqlite` → `rondo_club_members`
2. Builds customer records containing only first name, last name, and email address
3. Computes `source_hash` per customer
4. Upserts the minimal identity into `data/freescout-sync.sqlite` → `freescout_customers`

### Customer Submit

**Script:** `steps/submit-freescout-sync.js`
**Function:** `runSubmit({ logger, verbose, force })`

1. Reads customers from `data/freescout-sync.sqlite` where `source_hash != last_synced_hash`
2. For each changed customer:
   - **No `freescout_id`**: `POST /api/customers` (create new customer)
   - **Has `freescout_id`**: `PUT /api/customers/{freescout_id}` (update existing)
   - Updates add the current source email without removing other valid customer emails
3. Stores the returned FreeScout customer ID as `freescout_id`
4. Updates `last_synced_hash` on success
5. Rate limited: exponential backoff on 5xx errors (1s, 2s, 4s)

**Output:** `{ total, synced, created, updated, skipped, deleted, errors }`

## Field Mappings

### Standard Customer Fields

Sent to `POST/PUT /api/customers`:

| FreeScout Field | Source | Origin |
|---|---|---|
| `firstName` | `fields.first_name` | `rondo_club_members.data_json` |
| `lastName` | `fields.last_name` | `rondo_club_members.data_json` |
| `emails[].value` | `fields.email_1`, falling back to `fields.email_2` | `rondo_club_members.data_json` |

The customer sync does not send phone numbers, photos, addresses, websites, social profiles, notes, company details, teams, KNVB IDs, membership dates, contribution data, or custom fields. FreeScout conversations still contain their original email content.

### Existing profile cleanup preview

Run the read-only preview on the production sync host before removing legacy profile data:

```bash
npm run preview-freescout-cleanup
```

The preview scans only customers tracked by `freescout-sync.sqlite` and reports aggregate counts for phone, photo, address, company, job title, notes, social profiles, websites, customer custom fields, and customer properties. It reads standard contact data from FreeScout's embedded customer fields. It prints no names, email addresses, customer IDs, or field values and does not change FreeScout. A later cleanup may clear stored profile data after explicit approval.

### Existing profile cleanup

After reviewing the preview and receiving explicit approval, clear profile data beyond names and email addresses with:

```bash
npm run cleanup-freescout-profiles -- --apply --confirm=remove-extra-profile-data
```

The cleanup changes only customers tracked by `freescout-sync.sqlite`. It clears phone numbers, photos, addresses, company, job title, notes, social profiles, websites, and non-empty customer custom fields. It never sends or changes customer names or email addresses. Use `--limit=1` for a canary run, inspect the aggregate after-count, and then run without a limit. The operation is idempotent and stops on the first failed profile so it can be safely resumed after investigation.

## Conversations Pipeline

The conversations pipeline downloads conversations from FreeScout and creates corresponding activities in Rondo Club, providing a unified timeline of member interactions.

### Flow

1. **Download** - Fetches conversations from FreeScout API
2. **Prepare** - Matches conversations to Rondo Club persons via email/customer ID
3. **Submit** - Creates activities on person records in Rondo Club

### Tracking

Conversations are tracked in `data/freescout-sync.sqlite` → `freescout_conversations` table to avoid duplicate activity creation. Each conversation is stored with its FreeScout ID and sync state.

### Integration

The conversations pipeline is:
- Integrated into the main FreeScout pipeline orchestrator
- Runs as part of the daily cron schedule
- Visible on the sync dashboard

## Database Tables Used

| Database | Table | Usage |
|---|---|---|
| `rondo-sync.sqlite` | `rondo_club_members` | Member data (name, contact, KNVB ID) |
| `freescout-sync.sqlite` | `freescout_customers` | Customer → FreeScout ID mapping + hashes |
| `freescout-sync.sqlite` | `freescout_conversations` | Conversation tracking for activity sync |

## CLI Flags

| Flag | Effect |
|------|--------|
| `--verbose` | Detailed per-customer logging |
| `--force` | Skip change detection, sync all customers |

## Error Handling

- Missing credentials cause immediate exit (not a silent skip)
- Individual customer sync failures don't stop the pipeline
- 5xx errors trigger exponential backoff (up to 3 retries)
- Conversation sync failures are tracked independently
- All errors collected in summary report

## Source Files

| File | Purpose |
|------|---------|
| `pipelines/sync-freescout.js` | Pipeline orchestrator (customers + conversations) |
| `steps/submit-freescout-sync.js` | FreeScout API sync + customer preparation |
| `steps/prepare-freescout-customers.js` | Customer data preparation |
| `tools/preview-freescout-customer-cleanup.js` | Read-only aggregate inventory of legacy customer profile data |
| `tools/cleanup-freescout-customer-profiles.js` | Explicitly confirmed removal of profile data beyond name and email |
| `steps/download-freescout-conversations.js` | Download conversations from FreeScout |
| `steps/prepare-freescout-conversations.js` | Match conversations to persons |
| `steps/submit-freescout-activities.js` | Create activities in Rondo Club |
| `lib/freescout-db.js` | FreeScout SQLite operations (customers + conversations) |
| `lib/freescout-client.js` | FreeScout HTTP client + credential check |
| `lib/rondo-club-db.js` | Rondo Club data lookup |
| `lib/http-client.js` | HTTP request utilities |
