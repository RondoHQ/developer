---
title: Profile photo sync to Sportlink
---

## Behaviour

Rondo Club 35.62.0 queues manually uploaded profile photos for Sportlink. The existing five-minute reverse-sync pipeline processes up to 25 pending photos per run when `RONDO_PHOTO_SYNC_ENABLED=1` on the sync server. People see whether their photo is pending, sending, confirmed or needs review.

Both WordPress and the worker enforce **1 July through 31 October inclusive**, using `Europe/Amsterdam`, including the Dutch-midnight UTC boundaries. Outside this window uploads remain in Rondo and wait for the following permitted season. Former members, local contacts and people without a KNVB ID cannot be exported. Existing photos are not backfilled automatically.

Rondo remains authoritative for a manually uploaded photo. Forward imports use `source=sportlink` and preserve these photos even after successful confirmation, preventing stale imports and echo loops. Later Sportlink-side edits therefore do not replace a manually managed Rondo photo; make subsequent changes in Rondo. Photos that were never manually queued retain their existing Sportlink import behaviour.

## Queue and concurrency

Jobs live in native person metadata: `_rondo_photo_sync` contains the revision UUID, attachment ID, KNVB ID, state and timestamps; `_rondo_photo_sync_state` is the query index. States are `pending`, `sending`, `review`, `synced` and `local_only`. A new manual upload supersedes pending work. Eligibility, thumbnail and KNVB identity are rechecked before export and claim.

A per-person Options API lock serializes uploads and claims. A crashed lock fails closed; inspect the exact `rondo_photo_lock_{person_id}` option before clearing it. The worker reads all candidate pages before changing job states, so a shrinking queue cannot skip a person. The existing reverse-sync process lock and the per-job claim prevent duplicate sends.

The worker reads the current Sportlink image fingerprint, checks it again before claiming and immediately before uploading, then verifies a changed image and nonempty photo date after reopening the exact profile. Photo bytes, signed CDN URLs and claim tokens are not logged. WordPress exports a bounded JPEG using its image editor; the user's selected crop is preserved.

An uncertain upload or acknowledgement becomes `review` or stays `sending`. Neither state is automatically retried. A successful HTTP click alone is not confirmation; inspect the actual Sportlink photo before resolving an uncertain job. Administrators can complete an already-verified sending job through the revision-and-token-bound endpoint. Keep the current attachment and revision when investigating; never re-upload blindly after a timeout.

## REST API

Only administrators can use the queue and job endpoints:

- `GET /rondo/v1/photo-sync-jobs?page=1&per_page=50`: valid pending jobs, `next_page` and calendar window. Maximum page size 100; no image bytes or claim tokens.
- `GET /rondo/v1/people/{id}/photo-sync-job`: the exact current job without its token.
- `GET .../photo-sync-job?include_file=true`: pending, in-season JPEG export as base64 with SHA-256.
- `POST .../photo-sync-job`: `action=claim`, `complete` or `review`, with `revision` and `knvb_id`. Completion/review also require the returned `claim_token`; completion requires `sportlink_photo_date` and `verified_sha256`.
- `POST /rondo/v1/people/{id}/photo`: existing upload endpoint with `source=manual` by default. `source=sportlink` is administrator-only and returns a successful skip for protected manual photos.

The person REST response exposes a human-readable `photo_sync_status`. There is no reverse-photo-delete operation.

## Deployment and first uploads

Deploy rondo-sync's source marker first, with automatic processing disabled. Then deploy the WordPress queue and confirm the explicitly selected initial uploads before setting `RONDO_PHOTO_SYNC_ENABLED=1`. No new cron schedule is needed. Run sync commands only as `rondo` in `/home/rondo` on the production sync server.

For one reviewed person, preview first:

```bash
node tools/sync-person-photo.js --person-id PERSON_ID --knvb-id KNVB_ID
```

Then pass the returned revision and fingerprint to `--apply`:

```bash
node tools/sync-person-photo.js --person-id PERSON_ID --knvb-id KNVB_ID --revision REVISION --expected-photo-hash HASH --apply
```

The initial two uploads were selected explicitly by the user after saving new Rondo crops. Their current attachment IDs, KNVB IDs and image hashes must still match before queueing; do not turn this into a general backfill. Visual crop verification in Sportlink is part of initial acceptance because Sportlink may re-encode the image.

On 12 September 2026, both explicitly selected production photos were uploaded successfully and their stored Sportlink crops visually matched the Rondo exports. One profile had no existing Sportlink photo; the other replaced an older photo. The initial read-only dashboard redirect was corrected by reusing the existing checked-navigation helper before either upload. Both jobs have confirmed photo dates and image fingerprints.

Automatic processing was then enabled with explicit approval for future manually changed photos of linked members within the permitted season. The production flag was read back as enabled and the deployed queue completed successfully with no pending jobs, confirming that the two completed uploads were not offered again. The existing five-minute cron schedule remains in use.
