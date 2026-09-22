---
title: "Tournament registrations"
---

Rondo manages tournament editions and one shared registration task per selected club team. A
positive registration creates one tournament invoice and a persistent Mollie payment link. The
manager overview also covers external processing, exports and programme distribution.

## Roles and assignment

Administrators and users whose linked person has a current work-history role named exactly
`Coördinator toernooien` can manage tournaments at `/toernooien`. The manager selects club teams
and current team staff, including people who do not yet have a Rondo account. Publishing creates one `rondo_tourn_entry` post per
club team, assigns every selected person to that shared entry, and sends the initial email.
The publication review can select every eligible team and all of its current staff in one action.
It shows the exact team and recipient counts and separately reports teams skipped because they have
no current staff member with a valid email address. Missing accounts and email addresses are shown separately.

The invitation list only shows teams with at least one current player, using the same member
counts as the team overview. Former members and ended player positions do not count; staff alone
do not make a team eligible for this list. Players do not need a Rondo account. The assignment
options API includes `player_count` for this filter and retains all teams so managers can still
maintain staff assignments on existing registrations after a team loses its last player.

Every signed-in user sees **Toernooien** in the personal menu and can open
`/mijn-toernooien`, even without an assignment. The list still contains only that user's assigned
registrations. An empty list explains that no tournament is currently available for registration
and invites the user to contact a tournament coordinator.

The empty state loads `GET /rondo/v1/tournaments/coordinators`, an authenticated contact directory
returning only `id`, `name`, `email` and `phone`. It includes published, non-former people with a
current `Coördinator toernooien` role, whether or not they have an account. Each person appears once;
ended and future roles are excluded. Email prefers `email_1` then `email_2`; phone prefers mobile
numbers then landlines. Email and phone are clickable, and missing contacts and loading failures
have explicit states. This narrow directory is available even when a member cannot open the
coordinator's full person record. It does not grant access to other people's registrations or to
tournament management.

Assigned staff use the same page to open their registrations. Multiple assignees edit the same draft with optimistic
locking, so an outdated browser cannot overwrite a newer version. There is deliberately no decline
or no-participation state: an entry can only remain open or become a positive registration.

After publication, a manager can edit the assignment for each club team from **Teams and
payments**. The picker reloads the current team-linked staff and can select all current
staff or an explicit subset. The server requires at least one current eligible person and the
entry's current `version`. Added staff immediately gain access and receive the assignment email at
most once; removed staff immediately lose access. Every change is recorded in the tournament
activity. Removing the selected contact from an open draft clears that choice, while a submitted
contact and all financial snapshots remain unchanged.

## Additional invitations and people without accounts

From **Teams and payments → Extra teams uitnodigen**, managers can select teams that were not
included at publication. The tournament must be open and its internal deadline must still be in
the future. Reopen the tournament or extend that deadline first if necessary. Existing shared
registrations, submitted contacts, invoices and payments remain unchanged. A repeated request for
the same team and selection reuses its entry and skips already sent invitations; changing staff on
an existing entry uses **Toewijzing wijzigen** instead.

The publish and invite endpoints accept `assignments: [{ team_id, person_ids: [...] }]`.
`POST /rondo/v1/tournaments/{id}/invite` is manager-only, as are publication and reassignment.
`PATCH /rondo/v1/tournament-entries/{id}/assignees` accepts `person_ids` plus the current `version`.
Older clients may continue sending `user_ids`; these are validated and mapped to the team's
current people. Person selections must belong to current team staff; former members, ended roles,
players and unrelated people cannot be newly invited. A newly selected person must have a valid
email address. New team invitations are serialized with the existing tournament write lock.

People without an account receive the same tournament invitation plus Dutch instructions to create
an account using the address receiving that invitation. The call to action links to `/activeren/`;
the email also retains the registration link. This uses the existing verified activation flow,
without creating accounts or granting permissions during invitation delivery. Once their account
has the normal `rondo_linked_person_id`, their assigned entry is available in **Toernooien** and at
`/mijn-toernooien/{entry_id}`. Sharing an email address does not share tournament access.

`assignment_snapshot` retains `person_id` and may contain `user_id: 0`. New and updated entries
have `_tournament_assigned_person_{person_id}` lookup metadata alongside positive user indexes.
Authorization checks the actual snapshot and trusted person link, so removing a pending assignee
also revokes access after later account creation. Entry responses include `assigned_person_ids`
and resolve current accounts without modifying stored history. Existing user-indexed entries remain
compatible; no production migration or bulk invitation is needed.

Invitation and initial payment receipts use `_tournament_{assignment|payment}_email_sent_person_{id}`
for person-backed rows, while existing user-based receipts remain valid. This prevents account
creation from resending an invitation and prevents two pending people from sharing a `user_id: 0`
receipt. A failed send is reported and can be retried through **Toewijzing wijzigen**; successful
recipients are skipped. Assigned staff without accounts also remain recipients of programme,
change and payment messages, using their current person email. Existing email deduplication for
programme and change messages remains in place.

## Registration model

One club team can register one or more tournament teams. Every tournament team has its own player
count. The contact must be one of the Rondo people linked to the staff accounts assigned to the
entry. The assignee chooses themselves or a colleague in one action; Rondo reads the name, email
address and mobile number from that person's profile and blocks confirmation while either contact
channel is missing. The person relation is authoritative, while the resolved contact details are
snapshotted for the invoice and export. On confirmation, Rondo also snapshots the entered teams,
player total, applicable price, and total amount.

Tournament schedule rows contain a local date and time in the WordPress site timezone. Deadlines
remain calendar dates without a time, and the internal deadline remains open through the end of the
selected day. A tournament manager can extend it, but it must remain in the future and before the
organiser's external deadline. Confirmed registrations are
read-only for assigned staff. A manager can reopen an unpaid registration: Rondo archives the old
payment link and invoice, restores the saved team draft, and creates a new invoice after the next
confirmation. Paid registrations cannot be reopened. If payment-link creation fails, the
registration remains valid. Rondo schedules a deduplicated automatic retry after five minutes and
uses increasing intervals up to one day until payment-link creation succeeds. The participant page
polls only while creation or recovery is pending and receives the payment email after success.

## Payment

Every submitted entry with a positive total gets one `rondo_invoice` with
`invoice_type=tournament` and an `O` invoice-number prefix. The invoice snapshots the team count,
player count, price, contact, linked person, and the Mollie account selected under
**Finance settings → Mollie → Standard for tournaments**. Changing that global default never moves
an existing invoice to another account.

Assigned staff see **Pay now** while payment is open. The existing verified Mollie webhook marks
the invoice paid; entry responses derive `payment_state` and `paid_at` from that invoice, so the
tournament manager sees the same status without financial permissions. Free registrations expose
`payment_state=not_applicable` and do not create an invoice.

Publishing is blocked until a usable dedicated tournament Mollie account is configured. A
tournament has its own payment deadline and configurable reminder days, defaulting to seven and two
days before that deadline. Confirmation sends the payment link once to every assigned staff member.
The daily scheduler sends each configured reminder moment at most once and skips entries that are
not submitted, have no open link, or are already paid. Managers can also send a manual payment
reminder from the tournament overview.

A tournament manager can delete both draft and published tournaments. Deletion moves the tournament
and every linked team registration to the WordPress trash, so they immediately disappear from the
manager and assignee interfaces. Rondo does not send cancellation messages; the confirmation warns
the manager that they must inform registered teams themselves.

## Manager operations

Managers can edit the operational information of an `open` or `closed` tournament, including its
name, organiser, location, description, schedule date and time, deadlines, and payment-reminder
days. The update requires the current tournament `version`, so a stale browser receives HTTP 409
instead of overwriting a newer edit. Target teams and assignments stay outside this generic update.
Pricing rules and game formats remain editable until the first entry becomes `submitted`; after
that point both the UI and server lock them, while existing registration and invoice snapshots
remain unchanged.

After a participant-visible update, the save response includes the private activity ID, changed
fields, and a deduplicated recipient preview. The manager may skip email or send that one change
once. Recipients are all current assignees of every selected team plus the contact of every
submitted entry. Delivery results are stored on the change activity; partial email failure never
rolls back the saved tournament update.

The published tournament detail has three tabs:

- **Overview** shows authoritative totals for the complete tournament and each age group, the
  internal, payment and organiser deadlines, lifecycle status, external processing status and the
  activity history.
- **Teams and payments** keeps selected teams visible even when they did not submit. Managers can
  filter the table, synchronize or redistribute assigned staff, inspect contacts, payment status and
  last payment email, recover an open payment, send a manual reminder, reopen an unpaid entry and
  maintain a private planner note.
- **Communication** stores a programme PDF or URL and message. Preview resolves current assigned
  staff and the shared contact of submitted registrations, deduplicates addresses case-insensitively
  and reports invalid addresses. Sending stores the exact subject, message, file or URL, timestamp
  and per-recipient result for later inspection.

External processing is tracked once per tournament as `not_processed`, `submitted` or `confirmed`.
The lifecycle can move from `open` to `closed` or `archived`; archived tournaments are read-only.
The CSV and landscape PDF exports use the same server-side dataset and include tournament metadata,
deadlines, totals, selected teams, submitted counts, contacts, payment state and planner notes. The
PDF also uses the configured club logo, accent color and accent background color from the finance
settings.

Operational changes, submissions, payment events, reminders and programme delivery are written as
private tournament activity comments. These comments are available only through the manager API.

## Storage and privacy

Tournament editions use the private `rondo_tournament` post type and team registrations use the
private `rondo_tourn_entry` post type. Both have `show_in_rest: false`; all reads and writes go
through the domain REST controller. Fields use the native Rondo field registry and numbered post
meta for repeaters. The generic WordPress REST API cannot expose either post type.

Entry reads are limited to the assigned accounts and tournament managers. Entry writes are limited
to assigned accounts, except that managers can redistribute the assignment through the dedicated
assignee route. The assignment stores person and user IDs plus a snapshot of names, roles, email
addresses and mobile numbers, with private per-user lookup markers for efficient personal task
lists. Failed payment recovery runs through a private WordPress cron hook and has no manual REST
action.

See [REST API](/api/rest-api/#tournament-registrations) for the endpoints.
