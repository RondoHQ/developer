---
title: Laposta newsletter drafts
---

Rondo prepares newsletter campaigns from Communication Planning. The editor uses one administrator-managed HTML template and the communication item's responsible user's signing profile. Export creates or updates a **draft** in Laposta. Testing, recipient counts, scheduling and sending remain in Laposta; exporting never completes the planning channel.

## Setup

Administrators with communication access configure `/communicatie/nieuwsbrief-instellingen`:

- A separate Laposta API-key option, encrypted through `CredentialEncryption`. Responses expose only `has_key`; leaving the password field empty preserves the key. Rondo does not read credentials from rondo-sync.
- The active communication channel used for newsletters (default `newsletter`).
- A shared HTML template and salutation. Prefer a generic salutation unless personalization fields have been verified for every target list.
- An active signing profile per eligible Rondo user: name, role, sender name, approved sender email, reply-to email, optional public HTTPS signature image and height.

Template placeholders are `%%DOCUMENT_TITLE%%`, `%%PREHEADER%%`, `%%SALUTATION%%`, `%%HEADING%%`, `%%BODY_HTML%%`, `%%SIGNER_NAME%%`, `%%SIGNER_ROLE%%`, `%%SIGNATURE_URL%%` and `%%SIGNATURE_HEIGHT%%`. All except document title and image fields are required, along with HTML head/body and `<unsubscribe>…</unsubscribe>` / `<webversion>…</webversion>` links. Unknown placeholders, scripts, forms and redirects are rejected. Profiles and template data are escaped; body HTML is restricted to paragraphs, headings, emphasis, links and lists. Planning attachments remain private and are not embedded.

## User flow

Select the newsletter channel on a planning item, then choose **Opslaan en nieuwsbrief bewerken**. The route is `/communicatie/planning/:id/nieuwsbrief`. Select a responsible user, choose existing Laposta lists and explicitly choose either one segment or the whole list for each. There is no default whole-list selection, and an invalid segment never falls back to the whole list.

Enter a subject, optional preheader, newsletter heading and formatted body. The internal planning description is separate. Desktop/mobile previews use the same server renderer as export, in a sandboxed iframe with a restrictive CSP.

**Controleren** saves the local draft, validates each list and segment and returns a ten-minute review token bound to the user, item, content, profile, template and audience definitions. **Concept maken/bijwerken in Laposta** revalidates these before exporting. Recipient totals are deliberately absent: the final audience and count must be checked in Laposta.

## REST contract

All routes below use `/rondo/v1` and the existing `communicatie` capability. Item routes also require a published communication item with the configured active newsletter channel. Settings and profile writes additionally require `manage_options`.

| Method and route | Purpose |
| --- | --- |
| `GET /newsletter` | Configuration availability and eligible users with signing profiles |
| `GET, PUT /newsletter/settings` | Administrator template, salutation, channel and write-only API key |
| `PUT /newsletter/profiles/{user_id}` | Partial signing-profile update |
| `GET /newsletter/lists` | Active Laposta list IDs and names; cached for 60 seconds |
| `GET /newsletter/lists/{list_id}/segments` | Existing segment IDs and names for one list |
| `GET, PUT /communications/{id}/newsletter` | Draft read / partial write with `revision` and `fields` |
| `POST /communications/{id}/newsletter/preview` | Unsaved `fields` rendered as sandbox-ready HTML |
| `POST /communications/{id}/newsletter/review` | Validate saved `revision`; return token, preview, profile and audiences |
| `POST /communications/{id}/newsletter/export` | Export the reviewed draft using `token` |

Draft fields are `assignee_id`, `newsletter_subject`, `newsletter_preheader`, `newsletter_heading`, `newsletter_body` and `newsletter_audiences`. Each audience row contains `list_id`, `scope` (`all` or `segment`) and `segment_id` (empty for a whole list). Incomplete selections can be saved locally but cannot be reviewed/exported. Maximum ten distinct lists. Stale drafts and remote conflicts return HTTP 409. A stale client must reload rather than overwrite.

## Storage and recovery

Newsletter fields use the native field registry on `rondo_comm_item`; audiences use numbered repeater meta. Profiles use `rondo_newsletter_profile` user meta. Settings use `rondo_newsletter_config`; the encrypted key uses `rondo_laposta_campaign_key`. `_rondo_newsletter_export` stores the unique campaign reference, remote ID, transaction phase, verified baseline, target HTML/settings, profile and template snapshot hash, audiences and verification time. This operational state is not exposed as editable domain fields. Duplicates and future recurrences never inherit an export ID or review token.

The shared `rondo_comm_edit_{id}` option lock covers the complete local save/review/export transaction. A unique campaign name is persisted before creating a draft. After an ambiguous timeout, Rondo reconciles that reference against Laposta before proceeding; zero or multiple matches block rather than blindly creating another campaign. Definite rejected creates may be retried. Partial settings/content imports can resume only when the remote state exactly matches the saved baseline or interrupted target.

Every successful export reads back settings and HTML. A second unchanged export verifies but does not write. External changes to content/settings, planned or sent campaigns, import warnings, missing segments and mismatched readback block success. A campaign ID is retained immediately after creation, even when content upload fails, so users can inspect it through the Laposta link. Rondo never silently detaches an uncertain campaign; investigate and reconcile before a new attempt.

Laposta offers no documented conditional-write mechanism. The item lock prevents concurrent Rondo edits, and baseline checks detect prior Laposta edits, but users should not edit the same campaign in Laposta while exporting from Rondo. Segment membership can change after review; the definitive check belongs in Laposta immediately before sending.

`LapostaClient` uses the fixed API host and allows only campaign create/update/content operations and list/segment/campaign reads. It cannot call send, schedule, testmail, member-write or delete endpoints. Rate limits respect `Retry-After`; errors never include credentials or raw remote response bodies. Demo-site exports are disabled.

## Verification

`vendor/bin/codecept run Wpunit NewsletterTest` covers access restrictions, secret redaction, canonical storage and cleanup, stale writes, explicit audiences, audience/profile invalidation, idempotent draft exports, timeout recovery, remote edit conflicts and planned-campaign blocking. For live acceptance use an empty list/segment and an unsent draft, then verify the actual recipient selection and unplanned status in Laposta. Never test by sending to a member list.
