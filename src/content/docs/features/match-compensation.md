---
title: Match registration and monthly compensation
---

The season **2026–2027** pilot records match selections for configured teams and closes each team's month independently. Registrators use `/teams/{id}/registratie`, linked from the team's match tab. Finance users use `/financien/wedstrijdvergoedingen`. Rondo produces files for external processing; it does not execute bank payments or send data to Nmbrs.

## Configuration and access

An administrator configures existing published teams with scheme `awc1` or `jo23`, registrator assignments and a retention-policy text in `rondo_match_compensation`. No teams are enabled by default. The admin picker offers all users, while existing assignment rows contain only users with positive assigned team IDs.

Payroll settings include `debtor_number`, `company_number`, `basis_code`, `bank_code`, `win_code` and `draw_code`. The defaults are `U2150` for starters, `L3090` for wins and `L3091` for draws; the bench code has no default. All six settings must be present before closing a month with payroll rows. Administration numbers accept 1–14 digits without a leading zero. Component codes use `U` or `L` followed by four digits; the bench code must start with `U`.

Registrators need `wedstrijdregistratie`, a team ID in `_rondo_match_teams` and existing access to that team. Configuration cannot grant otherwise missing team access. Removing an assignment revokes registration access; finance permission alone does not allow editing selections. Teams with registration history cannot be removed or switched to another scheme.

Finance readers can inspect monthly totals and batches. Their IBAN values are masked to the final four characters; responses omit account-holder names, Nmbrs names, employee numbers, agreement snapshots and participation allocations. Finance managers and administrators can manage agreements, close months, export, record processing and open correction rounds. Agreement access also requires access to the published person. Only administrators configure or import. Financial previews omit individual absence reasons.

## Dated AWC 1 agreements

The **Afspraken** tab manages `match_compensation_agreements` on existing people. Each row contains `team_id`, `valid_from`, optional `valid_until`, `payment_route`, `nmbrs_employee_number` and `nmbrs_name`. The team must use scheme `awc1`. Dates use `YYYY-MM-DD`, and both boundaries are inclusive.

Each eligible participation needs exactly one agreement on the played date. Choose `payroll` for an employee agreement or `sepa_guest` for direct payment. A guest label in the selection does not choose the payment route: a guest can have a payroll agreement. A standalone person-level `nmbrs_name` does not create an agreement.

Payroll agreements require a confirmed name and an employee number of 1–30 ASCII letters, digits or hyphens. Direct-payment agreements clear both payroll fields. Agreements for the same team cannot overlap. Two people cannot share the same employee number during overlapping payroll periods. Writes require financial management and the person's bank-write policy: deceased people are not editable; former members require an administrator.

Open months use the current agreements, including removed or shortened periods. The editor lists potentially affected open months. Closed batches retain their agreement and payroll configuration snapshots. Generic person-field writes cannot bypass agreement validation, even for administrators.

## Registration and calculation

A registration records source identity, date, opponent, home/away, category, numeric home and away scores, selection, reason and `draft`/`completed` phase. Selection statuses are `basis`, `bank`, `not_selected`, `injured`, `suspended` and `other_team`; blank means unknown. Guest players use existing visible published people and follow the registered match team's scheme.

Completion requires a played date inside July 2026–June 2027, scores and a nonempty selection with every status known. An explanation is required when there are not exactly eleven starters, when correcting an already completed registration, and for `manual:` source identities. Duplicate people and duplicate team/source-match registrations are rejected.

Only `competitie` and `nacompetitie` count. Cup and friendly registrations can be retained but produce no compensation. Both starters and bench players earn result premiums:

| Scheme | Win | Draw | Loss | External output |
| --- | --- | --- | --- | --- |
| `awc1`, `payroll` | 1 win count | 1 draw count | No result premium | Nmbrs counts, plus starter/bench and participation counts |
| `awc1`, `sepa_guest` | €110 per participation | €50 | €20 | Rabobank payments: €20 per match plus €30 per point |
| `jo23` | €45 per participation | €15 | €0 | Rabobank premium payments |

Calculations use integer cents. `days` counts match participations, including two matches on the same calendar day. AWC 1 payroll rows contain counts, with `amount_cents` set to zero; Nmbrs applies the configured payroll components. The monthly payroll roster includes everyone whose payroll agreement overlaps the month, even with no participation. Direct-payment rows arise from eligible participation. Unknown or ambiguous agreements appear as blocking preview errors.

Nonmanual registrations verify the current team feed. Missing/cancelled sources and stale feeds block saving; source date, result or unknown-category deviations need an explanation. Monthly preview also checks missing eligible source matches, changed source fingerprints and registrations whose source disappeared. Retained history is not silently deleted.

## Monthly closing, files and corrections

Preview returns `rows`, `settlement_rows`, `sources`, blocking `errors`, a `fingerprint` and existing batch summaries. Closing requires a current fingerprint, `all_matches_confirmed: true`, no errors and a configured retention policy. Positive JO23 and AWC 1 direct payments need valid member IBANs and account-holder names. Agreement changes, bank details and payroll settings affect the fingerprint. Closing stores registration versions, totals, payment details, agreements, payroll configuration and participation allocations. A closed month rejects new or edited registrations until a correction round is opened.

### Payroll and bank exports

New AWC 1 batches use `schema_version: "2"` and separate `payroll` and `sepa_guest` routes. Their export and processing requests require `route`. The batch summary exposes `routes` with `applicable`, `exported` and `processing` for each route. The first export requires `confirmed: true` that this route has not been processed or queued.

Payroll downloads an XLSX with sheets `Start`, `LooncomponentenVar`, `Blad1` and `Kostenverdeling (variabel)`; the last two are hidden. Row 2 holds administration identifiers and configured component codes. Data rows hold the employee number, confirmed name, `YYYY-MM` period and participation counts. Zero counts and `DagenVoorLC` stay blank. Text cells cannot become formulas. The response provides `encoding: "base64"`, XLSX MIME type and a filename; decode `content` before downloading.

The XLSX employee number must be 1–14 digits without a leading zero. Agreements preserve other valid employee-number strings, but export rejects them to prevent a lossy numeric import. `payroll_import_confirmed` must be true after the payroll administrator confirms the trial import and blank-zero behavior. An export with a previous processed baseline also requires `payroll_corrections_confirmed` for the agreed correction procedure.

AWC 1 direct payments and JO23 download multi-recipient `pain.001.001.09` XML through `SepaCreditTransfer`. They require a Dutch Rabobank debtor account, valid SEPA recipients and an execution date from today through one year ahead. Only positive amounts become payment rows. The description identifies the team, month and year.

Files are stored in private post metadata before being returned, with a SHA-256 hash, route, creation time and actor. Repeat downloads return the stored content and identifiers. Creating or downloading a file does not mark the batch processed. Legacy AWC 1 batches retain their original CSV contract and stored files; the new fields are not inferred into historical batches.

### External processing

Record external processing separately with `kind`, `date` (not in the future) and `reference`. Use `nmbrs` for payroll, `paid` for ordinary bank payments, or `manual_correction` for a bank route containing negative corrections. A second different processing record for the same route is rejected.

### Corrections and route changes

A correction needs a reason and marks the old batch `superseded`. For every applicable unprocessed route, `previous_file_unused: true` confirms that its file was not used and will not be used. Processed routes produce differences against their processed full snapshot; unprocessed routes retain the prior processed baseline, if any. Rows use person, route and employee number as their identity. A bank route with any negative amount cannot be exported; handle and record that route's whole correction manually. Differences stay attached to the original month.

Changing a processed participation's route or employee number blocks closing, even when total counts stay equal. First reverse all earlier external processing for that person and month. Then use `route-corrections` on the latest superseded batch with `person_id`, `confirmed: true`, a nonfuture `date` and evidence `reference`. This records the external reversal; Rondo does not perform it. The next version recalculates that person's month from the current agreements. Old files remain available for audit after superseding, without becoming new payment instructions.

## REST API and retry contracts

Routes below are relative to `/rondo/v1/match-compensation`, require approved authentication and apply the role checks above. Successful responses use `Cache-Control: private, no-store`.

| Method and route | Purpose |
| --- | --- |
| `GET /settings`, `POST /settings` | Read scoped configuration / admin replacement of configuration |
| `GET /teams/{team_id}/registrations` | Assigned registrator's committed registrations |
| `POST /registrations` | Create with `team_id`, partial `fields` and `request_id` |
| `PATCH /registrations/{id}` | Update with `fields`, `expected_version` and `request_id` |
| `GET /months?team_id=…&month=YYYY-MM` | Financial preview, July 2026–June 2027 |
| `POST /batches` | Close a checked preview using `team_id`, `month`, fingerprint and confirmation |
| `GET /batches/{id}` | Financial snapshot and export/processing summary |
| `POST /batches/{id}/exports` | Create or redownload the stored file |
| `POST /batches/{id}/processing` | Record external processing |
| `POST /batches/{id}/corrections` | Open a correction round |
| `POST /batches/{id}/route-corrections` | Record a confirmed external reversal before changing a processed route or employee number |
| `GET /agreements?team_id=…` | Finance-manager agreement roster of visible people |
| `GET /people/{id}/agreements` | Agreements, version, closed months and edit permission |
| `PATCH /people/{id}/agreements` | Replace the agreement list using `agreements`, `version` and `request_id` |
| `PATCH /people/{id}/nmbrs` | Finance-manager update of `nmbrs_name` |
| `POST /imports/preview` | Admin validation of prepared source-to-person registrations, no writes |
| `POST /imports` | Admin application of that checked mapping |

Registration and batch mutations require `request_id`: 16–80 ASCII letters, digits or hyphens. A durable per-user receipt hashes the operation and input; identical retries recover the same result and changed input under the same key receives HTTP 409. Registration PATCH also checks `expected_version`. A site-specific kernel file lock serializes changes and is released after process failure. Validation normally returns HTTP 400; source/version/fingerprint conflicts and busy locks use 409.

Agreement PATCH uses the same receipt and lock contract. It replaces the person's full list, including other teams, with at most 100 rows. `[]` clears it. The `version` is a SHA-256 hash of the previous canonical list; a stale value returns 409. An interrupted storage update keeps the old list visible and blocks affected closing. Retry the same request after fixing the failure.

Imports accept 1–100 prepared `registrations`, never infer identities or create people, and return `matches`, `errors` and `preview_hash`. Applying requires that hash, `confirmed: true` and a `backup_reference`. Each registration uses a deterministic retry key. An interruption preserves already stored matches; retry the same mapping instead of generating new source IDs. This endpoint does not read the old spreadsheet or mark historic payments processed automatically.

## Storage and verification

Private CPTs `rondo_match_reg` and `rondo_match_batch` are hidden from generic REST and admin screens. The native registry declares selection, batch-row and person-agreement repeaters. `_match_pending` and `_match_committed` distinguish partial storage from a complete readback-verified snapshot. Agreements use `_match_agreement_pending` to retain the old list until readback succeeds, plus request and audit metadata. Their candidate lookup runs separate filtered queries for saved and pending lists, deduplicating people by ID without dropping pending-only records.

Batches retain source versions, full/baseline rows and participation allocations. New AWC 1 batches store route-specific `_match_export_{route}` and `_match_processing_{route}` values, plus `_match_route_reversals`; legacy batches retain `_match_export` and `_match_processing`. The retention-policy text gates first use; it does not schedule automatic deletion.

Implementation: compensation service, agreements, payroll, calculator, lock, REST controller, the native field registry and `MatchCompensation.jsx`. `MatchCompensationTest` and `MatchCompensationAgreementsTest` cover calculations, date boundaries, full payroll rosters, guest routes, permissions, source drift, retries, pending storage, immutable XLSX/XML files, partial corrections, route reversals and legacy downloads. These source tests describe the contract; the daily documentation run does not execute source pipelines.
