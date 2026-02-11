---
title: "Web Server API"
---

The Rondo Sync web server (Fastify on port 3000) exposes a programmatic API for triggering syncs from external systems like Rondo Club.

## Authentication

API endpoints use a shared API key, separate from the dashboard session auth.

**Header:** `X-Sync-API-Key: {key}`

The key is set via the `SYNC_API_KEY` environment variable on the sync server. Generate one with:

```bash
openssl rand -base64 32
```

| Scenario | Status | Response |
|----------|--------|----------|
| Missing header | 401 | `{ ok: false, error: "Missing X-Sync-API-Key header" }` |
| Invalid key | 403 | `{ ok: false, error: "Invalid API key" }` |
| Key not configured on server | 503 | `{ ok: false, error: "API key not configured on server" }` |

## Endpoints

### POST /api/sync/individual

Syncs a single member from Sportlink to Rondo Club. Launches a Playwright browser session to fetch fresh data from Sportlink (functions, committees, free fields), then syncs the member to WordPress.

**Rate limit:** 5 requests per minute.

**Concurrency:** Only one individual sync can run at a time (Sportlink uses TOTP, so only one Playwright session is possible).

#### Request

```json
{
  "knvb_id": "12345678"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `knvb_id` | string | Yes | KNVB member ID (numeric, 6-10 digits) |

#### Responses

**Success (200)**

```json
{
  "ok": true,
  "knvb_id": "12345678",
  "action": "updated",
  "rondo_club_id": 456
}
```

| `action` value | Meaning |
|----------------|---------|
| `created` | New person created in Rondo Club |
| `updated` | Existing person updated |
| `skipped` | No changes detected (member already up to date) |

**Errors**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid or missing `knvb_id` | `{ ok: false, error: "Invalid knvb_id: must be a numeric string of 6-10 digits" }` |
| 422 | Member not found in Sportlink data | `{ ok: false, error: "Member not found" }` |
| 429 | Another sync already running | `{ ok: false, error: "Another individual sync is already in progress. Try again in a minute." }` |
| 500 | Internal error | `{ ok: false, error: "Internal sync error" }` |

#### Example

```bash
curl -X POST https://sync.example.com/api/sync/individual \
  -H 'Content-Type: application/json' \
  -H 'X-Sync-API-Key: your-api-key-here' \
  -d '{"knvb_id":"12345678"}'
```

## Configuration

Add to the sync server's `.env`:

```bash
SYNC_API_KEY=your-generated-key-here
```

After adding the key, restart the web server:

```bash
systemctl restart rondo-sync-web
```

The same key must be configured in Rondo Club's `.env` so WordPress can call this endpoint.
