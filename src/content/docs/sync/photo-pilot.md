---
title: "Photo upload pilot: Rondo Club to Sportlink"
---

## Scope

The prototype adds cropping to Rondo's person photo picker and an explicitly invoked, single-person upload to Sportlink. It is **not connected to cron**, does not backfill existing Rondo photos, and has not yet completed an actual Sportlink upload. The current Sportlink photo dialog, file input, and upload button were inspected in an authenticated browser on 12 September 2026 without changing a photo.

After selecting an image, the user can drag, pinch with two fingers, zoom with the slider, use arrow keys, reset or cancel the square crop. Pinching keeps the source point under the fingers' midpoint and supports continuing with one finger without jumping; zoom is limited to 1–4×. Touch gestures are captured only inside the crop viewport. Saving exports a JPEG up to 800 × 800 pixels, without enlarging a small crop. The uploaded crop becomes the Rondo profile photo and the source for the Sportlink job. GIF input becomes a still image. A local browser fixture at `tests/fixtures/photo-crop-preview.html` exercises the real component and displays the exported dimensions and format.

## Calendar and eligibility

Both WordPress and the worker enforce **1 July through 31 October inclusive**, in `Europe/Amsterdam`, including the UTC boundary at Dutch midnight. The worker checks again before selecting the file and before clicking Upload. Outside the window, a photo stays in Rondo and its status explains the next 1 July. Reaching July makes the job eligible; the pilot still requires an operator invocation.

Only a published, current person with a matching KNVB ID is eligible. Former members and `person_type=contact` are excluded even if a stale KNVB ID exists. Unlinked photos remain local. This pilot follows the requested strict calendar for all uploads, including members with no existing photo; any broader exception is a separate product decision.

## Durable jobs and overwrite protection

One `_rondo_photo_sync` post-meta object records the latest attachment, revision UUID, KNVB ID, state and timestamps. No custom WordPress tables are used. The person response exposes only a human-readable `photo_sync_status`, never the claim token or file bytes.

States: `pending`, `sending`, `review`, `synced`, `local_only`. The presentation derives `waiting_window` when a pending job is outside the season. `sending` blocks another manual upload. A new manual upload supersedes a pending job by giving it a new revision. A changed linked KNVB ID or thumbnail invalidates the job at export and claim time.

A short per-person Options API lock serializes manual and forward-sync uploads with claim/callback requests. Crashed locks deliberately do not expire automatically; investigate the interrupted operation before clearing the specific `rondo_photo_lock_{person_id}` option.

Incoming uploads declare `source=sportlink`; only administrators can use that source. The photo endpoint returns `success=true, skipped=true, reason=manual_photo_protected` for imports into any manually owned photo. This protection remains after successful sending in the pilot. Future Sportlink-side edits therefore do **not** automatically replace that Rondo photo; conflict reconciliation is a prerequisite for general rollout. This prevents stale imports and echo loops without making a timestamp-only overwrite decision.

The existing forward-sync delete request currently has no registered DELETE photo route in Rondo Club. This pilot does not add a delete route or send deletions to Sportlink.

## REST contract

All job endpoints require `manage_options`, matching the existing sync service permissions.

- `POST /rondo/v1/people/{id}/photo`: existing file upload, with `source=manual` (default) or `source=sportlink`.
- `GET /rondo/v1/people/{id}/photo-sync-job`: exact current job, identity and window; no image or claim token.
- `GET .../photo-sync-job?include_file=true`: only eligible pending work during the window; produces a JPEG payload with base64 bytes and SHA-256. Small images are not enlarged; larger direct API uploads are resized to fit 1200 × 1200. Temporary exports are deleted.
- `POST .../photo-sync-job`: JSON `action`, `revision`, `knvb_id`. `claim` transitions pending to sending and returns a claim token; `complete` and `review` additionally require that token. Completion requires `sportlink_photo_date` and `verified_sha256`. Replayed, stale and mismatched callbacks fail closed.

Image bytes travel over the authenticated Rondo API. The worker downloads the stored Sportlink image from the signed HTTPS URL returned by the member header, without forwarding Rondo credentials. Neither image bytes, signed URLs nor claim tokens are printed by the command.

## Single-person trial

Deploy the `source=sportlink` addition in rondo-sync **before** exposing manual queuing in Rondo Club, so imported photos cannot be mistaken for user uploads. Then make one new manual upload and review the chosen crop. Do not enable automatic processing or import older Rondo photos as part of this pilot.

Run only on the production sync server, using the verified Rondo person ID and KNVB ID:

```bash
node tools/sync-person-photo.js --person-id PERSON_ID --knvb-id KNVB_ID
```

Preview returns the current revision and the existing Sportlink image fingerprint (`none` for no photo). After reviewing that exact person and crop, pass both values to the write invocation:

```bash
node tools/sync-person-photo.js --person-id PERSON_ID --knvb-id KNVB_ID --revision PREVIEW_REVISION --expected-photo-hash PREVIEW_HASH --apply
```

The worker rechecks both identities, the Rondo revision, the current Sportlink image fingerprint and calendar before writing. It opens the inspected photo dialog, selects the prepared JPEG and clicks Upload. A changed stored image and nonempty photo date read after reopening the exact member page are required before acknowledging completion. Sportlink can re-encode images, so this verifies a changed saved image, **not pixel equality to the selected crop**. Visual verification of the actual crop in Sportlink is required for the first trial. Any unexpected crop dialog, unchanged image, timeout, or uncertain callback parks the job for review without retrying the upload.

## Before wider release

Complete one authorized end-to-end upload and compare the displayed Rondo crop with Sportlink after reloading. Inspect actual upload responses and any additional crop/confirmation screens. Add reconciliation for subsequent Sportlink edits, a reviewed recovery action for uncertain jobs, and scheduled processing only after the single-person trial succeeds. Failed acknowledgement must never blindly resend a possibly saved photo.
