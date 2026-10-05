---
title: Match registration and monthly compensation
---

The season **2026–2027** pilot records match selections for configured teams and closes each team's month independently. Registrators use `/teams/{id}/registratie`, linked from the team's match tab. Finance users use `/financien/wedstrijdvergoedingen`. Rondo produces files for external processing; it does not execute bank payments or send data to Nmbrs.

## Configuration and access

An administrator configures existing published teams with scheme `awc1` or `jo23`, registrator assignments, an optional Nmbrs bench code and a retention-policy text in `rondo_match_compensation`. No teams are enabled by default. The admin picker offers all users, while existing assignment rows contain only users with positive assigned team IDs.

Registrators need `wedstrijdregistratie`, a team ID in `_rondo_match_teams` and existing access to that team. Configuration cannot grant otherwise missing team access. Removing an assignment revokes registration access; finance permission alone does not allow editing selections. Teams with registration history cannot be removed or switched to another scheme.

Finance readers can inspect monthly totals and batches; their IBAN values are masked to the final four characters and account-holder names omitted. Finance managers and administrators can close months, export, record processing and open correction rounds. Only administrators configure or import. Financial previews omit individual absence reasons.

## Registration and calculation

A registration records source identity, date, opponent, home/away, category, numeric home and away scores, selection, reason and `draft`/`completed` phase. Selection statuses are `basis`, `bank`, `not_selected`, `injured`, `suspended` and `other_team`; blank means unknown. Guest players use existing visible published people and follow the registered match team's scheme.

Completion requires a played date inside July 2026–June 2027, scores and a nonempty selection with every status known. An explanation is required when there are not exactly eleven starters, when correcting an already completed registration, and for `manual:` source identities. Duplicate people and duplicate team/source-match registrations are rejected.

Only `competitie` and `nacompetitie` count. Cup and friendly registrations can be retained but produce no compensation. Both starters and bench players earn result premiums:

| Scheme | Win | Draw | Loss | External output |
| --- | --- | --- | --- | --- |
| `awc1` | €90 per participation | €30 | €0 | Nmbrs counts, plus starter/bench counts for external allowances |
| `jo23` | €45 per participation | €15 | €0 | Rabobank premium payments |

Calculations use integer cents. `days` counts match participations, including two matches on the same calendar day. AWC 1 base/bench allowances are not calculated as euro amounts in Rondo. The CSV contains `Naam`, confirmed `Naam in Nmbrs`, `Dagen`, `L3090 winst`, `L3091 gelijkspel`, `U2150 basis` and the configured bench-code column, or a clear placeholder if no code is set.

Nonmanual registrations verify the current team feed. Missing/cancelled sources and stale feeds block saving; source date, result or unknown-category deviations need an explanation. Monthly preview also checks missing eligible source matches, changed source fingerprints and registrations whose source disappeared. Retained history is not silently deleted.

## Monthly closing, files and corrections

Preview returns `rows`, `settlement_rows`, `sources`, blocking `errors`, a `fingerprint` and existing batch summaries. Closing requires a current fingerprint, `all_matches_confirmed: true`, no errors and a configured retention policy. AWC 1 needs confirmed Nmbrs names; positive JO23 payments need valid member IBANs and account-holder names. Registration versions, calculated totals and payment details are snapshotted on closing. A closed month rejects new or edited registrations until a correction round is opened.

The first export requires `confirmed: true` that the month has not already been processed or queued. AWC 1 downloads a semicolon-delimited CSV with spreadsheet-formula escaping. JO23 downloads multi-recipient `pain.001.001.09` XML through the shared `SepaCreditTransfer` service: a Dutch Rabobank debtor account, valid SEPA recipients and a date from today through one year ahead are required. Only positive premiums become payment rows. Files are stored in private post metadata before being returned. Repeat downloads return the stored bytes and identifiers. Creating or downloading a file does not mark the batch processed.

Record external processing separately with `kind`, `date` (not in the future) and `reference`: `nmbrs` for AWC 1, `paid` for ordinary JO23 batches, or `manual_correction` for JO23 corrections containing negative premiums. A second different processing record is rejected.

A correction needs a reason and marks the old batch `superseded`. If it was not processed, `previous_file_unused: true` is required and its replacement remains a full instruction relative to the prior processed baseline, if any. After processing, the new version contains only differences against the processed full snapshot. JO23 corrections with any negative premium cannot be exported; handle and record the whole correction manually. Differences stay attached to the original month rather than a future month.

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
| `PATCH /people/{id}/nmbrs` | Finance-manager update of `nmbrs_name` |
| `POST /imports/preview` | Admin validation of prepared source-to-person registrations, no writes |
| `POST /imports` | Admin application of that checked mapping |

Registration and batch mutations require `request_id`: 16–80 ASCII letters, digits or hyphens. A durable per-user receipt hashes the operation and input; identical retries recover the same result and changed input under the same key receives HTTP 409. Registration PATCH also checks `expected_version`. A site-specific kernel file lock serializes changes and is released after process failure. Validation normally returns HTTP 400; source/version/fingerprint conflicts and busy locks use 409.

Imports accept 1–100 prepared `registrations`, never infer identities or create people, and return `matches`, `errors` and `preview_hash`. Applying requires that hash, `confirmed: true` and a `backup_reference`. Each registration uses a deterministic retry key. An interruption preserves already stored matches; retry the same mapping instead of generating new source IDs. This endpoint does not read the old spreadsheet or mark historic payments processed automatically.

## Storage and verification

Private CPTs `rondo_match_reg` and `rondo_match_batch` are hidden from generic REST and admin screens. The native registry declares selection and batch-row repeaters. `_match_pending` and `_match_committed` distinguish partial storage from a complete readback-verified snapshot; version and actor metadata retain audit history. Batches retain `_match_sources`, `_match_full_rows`, `_match_baseline_rows`, `_match_export` and `_match_processing`. The retention-policy text gates first use; it does not schedule automatic deletion.

Implementation: `class-match-compensation-service.php`, calculator, lock, REST controller, `config/match-compensation-fields.php` and `MatchCompensation.jsx`. `MatchCompensationTest` covers calculations, guests, excluded categories, permissions, source drift, duplicate/replay handling, storage-failure recovery, closing fingerprints, immutable bank snapshots, XML schema/totals, Nmbrs names, imports and processed/unprocessed correction rounds. These source tests describe the contract; the daily documentation run does not execute source pipelines.
