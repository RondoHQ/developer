---
title: "Sponsor Companies"
---

Rondo stores sponsors as private `rondo_sponsor` posts. A company is separate
from the people who act as its contacts. All fields use the native field
registry and WordPress post meta; there are no custom tables.

## Data model

A sponsor company has a title, `publish` or `draft` status, featured-image logo,
structured address, `sponsor_role` (`businessclub` or `awc_sponsor`) and optional
stable `sponsit_contact_id`. `club_tv_priority` controls the AWC-defined display
frequency. The independent `club_tv_opt_out` flag records a Businessclub
sponsor's own preference without overwriting that frequency.

The `contacts` repeater contains `person_id`, `contact_role`, `is_primary`,
`receives_pass`, `is_primary_pass` and the stable `sponsit_person_id`. The
relation is stored only on the company. `Rondo\Sponsors\Relations` builds the
reverse person view, resolves pass eligibility and enforces one primary contact
per company and one primary sponsor-pass relationship per person.

Successful sponsor-contact logins, self-service logo replacements and actual
changes to the Club TV opt-out are stored as private `rondo_sponsor_log` posts.
Each entry keeps the sponsor, event type, timestamp and an actor-name snapshot.
Sponsor profiles return the newest 50 entries; a daily cleanup removes entries
older than 24 months. Re-saving an unchanged Club TV preference is not logged.

## Permissions and UI

Administrators and users with `sponsorbeheer` manage `/sponsors`. They can link
an existing person, create and link a new external contact, change relation
properties and archive a company. Unlinking never deletes the person. A sponsor
manager may update an external contact linked to a sponsor, but cannot change a
member/parent or delete any shared person record.

The private CPT is not exposed through `wp/v2`. Its API is:

| Method and route | Purpose |
|---|---|
| `GET`, `POST /rondo/v1/sponsors` | Search/list or create companies |
| `GET`, `PATCH`, `DELETE /rondo/v1/sponsors/{id}` | Read, update or archive |
| `POST /rondo/v1/sponsors/{id}/contacts` | Create an external person and relation |
| `POST`, `PATCH /rondo/v1/sponsors/{id}/narrowcasting-preference` | Store a Businessclub sponsor's own opt-out |
| `POST /rondo/v1/sponsors/{id}/logo/upload` | Replace the sponsor's own logo |
| `GET /rondo/v1/sponsor-person-options` | Find an existing person to link |

Person responses expose `sponsor_relationships` and `is_sponsor_contact` only
to sponsor managers. Public Club TV responses expose only company name and logo.

## Passes

A sponsor pass belongs to the person but derives its variant and displayed
company name from an active, pass-enabled relationship. If one relationship is
eligible it is selected automatically. With multiple eligible companies,
exactly one must have `is_primary_pass=true`; otherwise no arbitrary pass is
issued. Legacy person fields remain a temporary fallback during migration.

## Migration

`wp rondo sponsors migrate` is a read-only dry-run. It groups legacy sponsor
persons by Sponsit company ID and then by normalized company name. Missing names,
conflicting roles and company-like pseudo-persons are review rows and are not
written.

`--overrides=<json>` accepts reviewed `company_names`, `sponsor_roles`,
`company_only_person_ids` and `skip_person_ids`. `--apply` creates or updates
only ready groups. The command is idempotent and retains legacy person IDs for
audit and rollback; it does not delete or clear the original records.

Rondo Sync subsequently owns companies with a `sponsit_contact_id`. It archives
only missing Sponsit-owned companies and never overwrites or archives manually
created companies without that ID.
