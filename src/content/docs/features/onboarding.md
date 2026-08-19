---
title: "Onboarding (new members & volunteers)"
description: "Branded onboarding emails for newly joined members and volunteers, sent from the Rondo Club Onboarding screen"
---

The Onboarding feature is a UI for sending a welcome email to every member or volunteer who joined recently. It replaces an external send-via-LaPosta workflow that produced false positives. Once a person has been onboarded, the system stamps a per-type timestamp on them so they drop out of the list and cannot be onboarded again by accident.

## Overview

Two cohorts, two templates, two stamps:

| Cohort | Period | Required state | Sent-timestamp field |
|--------|--------|----------------|----------------------|
| Nieuwe leden | `lid-sinds` within last 30 days | not a former member and not a new volunteer | `onboarding-email-lid-sent` |
| Nieuwe vrijwilligers | `vrijwilliger-sinds` within last 60 days | `huidig-vrijwilliger = 1`, not a former member | `onboarding-email-vrijwilliger-sent` |

The cohorts are mutually exclusive. A current volunteer whose `vrijwilliger-sinds` date falls inside the 60-day window appears only under **Nieuwe vrijwilligers**, even when that volunteer email has already been sent. This prevents the same person from receiving both welcome emails. A new member who has been a volunteer for longer than 60 days remains eligible for the member email.

`VolunteerStatus` derives a missing `vrijwilliger-sinds` value from the earliest start date among active staff and committee positions when work history makes someone a current volunteer. Sportlink team rosters do not expose a role start date; on a genuine non-volunteer-to-volunteer transition, Rondo therefore falls back to the synchronization date. Existing volunteer-start dates are never overwritten, and an already-current volunteer without a source date is not assigned a new date. This keeps newly synchronized staff eligible for the 60-day onboarding cohort without treating an established volunteer's later role change as a new start.

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
| `onboarding_new_members=1` | lid-sinds ≤ 30 days ago AND onboarding-email-lid-sent is empty, excluding current volunteers whose vrijwilliger-sinds is within 60 days |
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
