---
title: "Onboarding (new members & volunteers)"
description: "Branded onboarding emails for newly joined members and volunteers, sent from the Rondo Club Onboarding screen"
---

The Onboarding feature is a UI for sending a welcome email to every member or volunteer who joined recently. It replaces an external send-via-LaPosta workflow that produced false positives. Once a person has been onboarded, the system stamps a per-type timestamp on them so they drop out of the list and cannot be onboarded again by accident.

## Overview

Two cohorts, two templates, two stamps:

| Cohort | Period | Required state | Sent-timestamp field |
|--------|--------|----------------|----------------------|
| Nieuwe leden | `lid-sinds` within last 30 days | not a former member and not a current volunteer | `onboarding-email-lid-sent` |
| Nieuwe vrijwilligers | `vrijwilliger-sinds` within last 60 days | `huidig-vrijwilliger = 1`, not a former member | `onboarding-email-vrijwilliger-sent` |

The cohorts are mutually exclusive. Every current volunteer is excluded from **Nieuwe leden**, regardless of when their volunteer work began or whether their volunteer welcome email was already sent. This also covers established volunteers who recently rejoined as members and prevents them from receiving the member welcome email.

`VolunteerStatus` derives a missing `vrijwilliger-sinds` value from the earliest start date among active staff and committee positions when work history makes someone a current volunteer. Sportlink team rosters do not expose a role start date; on a genuine non-volunteer-to-volunteer transition, Rondo therefore falls back to the synchronization date. Existing volunteer-start dates are never overwritten, and an already-current volunteer without a source date is not assigned a new date. This keeps newly synchronized staff eligible for the 60-day onboarding cohort without treating an established volunteer's later role change as a new start.

## Automatic onboarding foundation (35.73.0)

The existing manual sender above remains unchanged. The new **Instellingen →
Beheer → E-mails → Onboarding simulatie** tab is a read-only administrator tool.
It lists current records, recipient addresses, blocked addresses, source coverage,
possible due times and mail-block decisions. It is not a full rendered email preview.
No cron, transport call, automatic send toggle or generic follow-up task is added.

`Rondo\Onboarding\Recipients` collects all own addresses and, only below age 18,
addresses from explicit parent relationships. It deduplicates within the person,
preserves plus-addressing, excludes deceased contacts and synthetic login addresses,
and shows Lettermint suppressions. An unknown birthdate never authorizes parent mail.
The same mailbox may legitimately receive separate messages for two children.

`Foundation` stores internal observations in `_rondo_onboarding_observation` person
meta and historical rounds in the private `rondo_onboard_round` CPT. Neither is a
client-editable domain field. `Dispatch` uses the private `rondo_onboard_mail` CPT.
They are not exposed through generic WordPress REST routes or exports.

### Foundation API (all routes require `manage_options`)

| Route | Behavior |
|---|---|
| `GET /rondo/v1/onboarding/simulation?page=1&search=Emma` | Read-only list, 20 records/page; current people, not a claim that every listed record is a new member |
| `GET /rondo/v1/onboarding/simulation/{person_id}` | One current simulation, including `snapshot_hash` |
| `POST /rondo/v1/onboarding/observations/{person_id}` | Source-owned observation; no sending, no scheduling |

Observation JSON requires exactly `observation_id` (8–100 ASCII letters, digits,
hyphens or underscores), `knvb_id`, `observed_at` (RFC 3339 seconds with timezone),
`membership_state`, `snapshot_hash`, and `coverage`. Coverage has boolean entries
`person`, `parents`, `teams`, `functions`, `vog`: true means successfully fetched
**and** saved, including an explicitly empty result. The hash must match the current
stored fields/recipient set. A partial or failed check records false and blocks planning;
it does not change the last confirmed membership state.

Membership states are `not_member`, `preregistration`, `definitive`, `ended`.
The first observed definitive member is baseline, not a new candidate. Only a
subsequently confirmed transition from non-member, preregistration or a terminated
period opens a round. A termination requires an actual end date; rejoining requires
a later start. Source disappearance alone must never be submitted as termination.
Recognition uses server receipt time. The due time is 24 elapsed hours after the
later of recognition and the membership start at midnight in the club timezone.
Repeated observations do not postpone it. An open transfer or incomplete/newly changed
data blocks the simulation. No record creation date is used to infer new membership.

The producer must obtain source evidence before reading the hash and submit it
after all relevant saves. The hash alone is not proof of a complete Sportlink fetch.
The targeted Sync producer, initial population registration and definitive source
status mapping are **not yet connected** in this first foundation increment. Therefore
normal live records initially display unconfirmed coverage and no due time. Do not
backfill a guessed observation merely to make the simulation look ready. Volunteer
return rounds, final conditional templates and per-recipient account matching follow
in subsequent milestones; current volunteer roles only inform the block inventory.

### Delivery reservations

`Dispatch::reserve()` creates one durable reservation per round, message kind and
normalized address before future external work. A native unique option name enforces
the claim; the complete request payload and its hash are frozen in the private CPT.
Another claim is rejected, including after failure or acceptance. Crashed claims are
not automatically expired. `accepted()` requires and preserves the provider message ID.
No production code invokes these methods to send mail in this increment.

Provider submission, the 24-hour Lettermint idempotency window, status reconciliation,
partial retries, and webhook routing are not yet connected. A later sender must use
the same key and payload, record its first actual provider-attempt time, and refuse
blind retries after an uncertain outcome. A lock that survives a process crash needs
operator inspection; it must not be deleted just because it is old.

### Parent-name fallback in Sync

The parent preparer now uses `Ouder van {FirstName}` when Sportlink supplied a valid
parent email without a parent name. Siblings retain one shared mailbox record and
their child links. A real source name takes precedence over a generated name, and a
fallback never overwrites an existing known name. If even the child's first name is
missing, the preparer still omits the record rather than inventing a child identity;
this remains a source-data completeness issue for the forthcoming targeted check.

### Verification

`OnboardingFoundationTest` covers baseline/replay, future starts, proven rejoining,
partial/stale observations, recipient age boundaries and suppressions, durable
reservations, lock exclusion, API permissions and absence of email side effects.
`VolunteerStatusTest` covers explicit dates overriding stale flags. The Sync parent
tests cover generated names, real-name precedence and shared siblings. Local lint
may need `composer lint -- --ignore='tests/_output/*'` to exclude downloaded WordPress
test caches; production source remains fully checked.

## Access control

The Onboarding screen is gated behind a dedicated capability: **`ledenadministratie`** (Ledenadministratie). Administrators auto-receive it; everybody else needs an admin to grant it via **Instellingen → Beheer → Capabilities** (Ledenadministratie column) or by being assigned the `rondo_ledenadministratie` / `rondo_bestuur` role.

| Surface | Permission |
|---|---|
| Sidebar item "Onboarding" | hidden unless user has `can_access_ledenadministratie` |
| Route `/people/onboarding` | "Geen toegang" page unless capability present |
| `POST /rondo/v1/people/onboarding-email` | `check_ledenadministratie_permission` (`ledenadministratie` cap or admin) |
| `GET|POST /rondo/v1/onboarding/email-settings/{type}` | Admin only (`manage_options`) |

The cap is exposed on `GET /rondo/v1/user/me` as `can_access_ledenadministratie`.

## UI

**Route:** `/people/onboarding` (linked under Leden → Onboarding in the sidebar, visible only to users with `ledenadministratie`).

Two tabs (URL: `?tab=leden` or `?tab=vrijwilligers`). Each row shows the person, their start date, their email address, and a `Verstuur` button. A header checkbox plus row checkboxes feed a bulk `Verstuur geselecteerde` action.

The `Voornaam`, `Achternaam`, and start-date columns are sortable. The date column uses `field_lid_sinds` on the member tab and `field_vrijwilliger_sinds` on the volunteer tab; its first click sorts descending so the newest people appear first. Server-side ordering normalizes both compact `YYYYMMDD` storage values and legacy `YYYY-MM-DD` values before comparing them. When the active date sort is selected, switching tabs carries that sort over to the corresponding date field.

People without an email address show "Geen e-mailadres" inline and cannot be selected — the server reports them back in the response payload, but they are skipped without erroring the batch.

The "E-mailteksten beheren" link in the header jumps to `/settings/admin/welkomstmail`, where the three templates live in three sub-tabs.

## REST endpoints

### List

`GET /rondo/v1/people/filtered` gains two boolean parameters:

| Parameter | Meaning |
|-----------|---------|
| `onboarding_new_members=1` | lid-sinds ≤ 30 days ago AND onboarding-email-lid-sent is empty, excluding every current volunteer |
| `onboarding_new_volunteers=1` | vrijwilliger-sinds ≤ 60 days ago AND huidig-vrijwilliger=1 AND onboarding-email-vrijwilliger-sent is empty |

The default former-member exclusion still applies, so people who already left do not appear.

### Send

**POST** `/rondo/v1/people/onboarding-email`

**Permission:** any approved Rondo user.

**Body:**
```json
{
  "person_ids": [1234, 1235, 1236],
  "type": "lid"
}
```

`type` is either `"lid"` or `"vrijwilliger"`.

**Response:**
```json
{
  "success": true,
  "type": "lid",
  "counts": {
    "sent": 2,
    "already_sent": 0,
    "no_email": 1,
    "send_failed": 0,
    "not_found": 0,
    "invalid_type": 0
  },
  "results": [
    { "person_id": 1234, "status": "sent", "recipient": "alice@example.org", "sent_at": "2026-05-26 14:51:03" },
    { "person_id": 1235, "status": "sent", "recipient": "bob@example.org", "sent_at": "2026-05-26 14:51:03" },
    { "person_id": 1236, "status": "no_email", "message": "Deze persoon heeft geen e-mailadres." }
  ]
}
```

Status values per person: `sent`, `already_sent`, `no_email`, `send_failed`, `not_found`, `invalid_type`. The timestamp is stamped **only** on a successful `wp_mail()` return — failures do not poison future retries.

### Template settings (admin only)

**GET / POST** `/rondo/v1/onboarding/email-settings/{lid|vrijwilliger}`

Reads / writes a single template:

```json
{
  "subject": "Welkom als lid van {club_naam}",
  "body": "<p>Beste {first_name},...</p>"
}
```

Each type is stored as two WP options (`rondo_onboarding_lid_subject` / `…_body`, `rondo_onboarding_vrijwilliger_subject` / `…_body`). The account-provisioning email options are untouched.

## Templates

The onboarding templates are grouped with the other editable messages under **Instellingen → Beheer → E-mails**:

| Sub-tab | Stored options | From address |
|---------|---------------|--------------|
| Account aanmaken | `rondo_welcome_email_subject` / `_body` / `rondo_welcome_from_email` / `_name` | Configurable |
| Nieuw lid | `rondo_onboarding_lid_subject` / `_body` | WordPress default (`wp_mail()`) |
| Nieuwe vrijwilliger | `rondo_onboarding_vrijwilliger_subject` / `_body` | WordPress default (`wp_mail()`) |
| IVA-goedkeuring | `rondo_iva_approval_email_subject` / `_body` | WordPress default (`wp_mail()`) |

The onboarding templates support these placeholders:

| Variable | Meaning |
|----------|---------|
| `{first_name}` | Voornaam |
| `{infix}` | Tussenvoegsel |
| `{last_name}` | Achternaam |
| `{full_name}` | Voornaam + tussenvoegsel + achternaam, properly joined |
| `{email}` | Person's email address |
| `{club_naam}` | Club name from `ClubConfig::get_club_name()` (falls back to `get_bloginfo('name')`) |

Body content is rendered through `Rondo\Notifications\EmailTemplate::render()` to wrap the message in the shared branded HTML layout. Plain text is auto-escaped through `EmailTemplate::format_plain_text()`; HTML is sanitized with `wp_kses_post()`.

## Data model

Two ACF datetime fields are added to the `person` post type:

- `onboarding-email-lid-sent` — `date_time_picker`, readonly, format `Y-m-d H:i:s`
- `onboarding-email-vrijwilliger-sent` — same shape

These are written by the server only — there is no UI to clear them. If you need to re-onboard someone, delete the post meta directly.

## Implementation

| File | Role |
|------|------|
| `includes/class-onboarding-email-sender.php` | `Rondo\Notifications\OnboardingEmailSender` — template loading, placeholder substitution, send, stamp, timeline log |
| `includes/class-rest-people.php` | Filter params + `POST /rondo/v1/people/onboarding-email` handler (`send_onboarding_emails`) |
| `includes/class-rest-users.php` | Template settings endpoints (`get_onboarding_email_settings` / `update_onboarding_email_settings`) |
| `acf-json/group_person_fields.json` | The two `date_time_picker` fields |
| `src/pages/People/PeopleOnboarding.jsx` | The screen |
| `src/hooks/usePeople.js` | `useSendOnboardingEmail` mutation, new filter params in `buildFilteredPeopleParams` |
| `src/pages/Settings/Settings.jsx` | Four-sub-tab `WelkomstmailTab` for editable email templates |

Each successful send also writes a timeline entry on the person via `CommentTypes::create_email_log()`, so the person's history shows when they received the onboarding email and which template was used.

## Related Documentation

- [User Provisioning](./user-provisioning.md) — the third welkomstmail template (account-creation email)
- [Email Delivery](./email-delivery.md) — `wp_mail` / SMTP infrastructure
- [People API](../api/people.md) — list endpoint and shared filters
