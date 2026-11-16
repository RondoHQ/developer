---
title: Survey analysis
---

Open **Communicatie → Enquêtes → Resultaten** and choose a published questionnaire
version. **Overzicht** shows response counts and configured metrics. Use **Vragen**,
**Open antwoorden** and **Inzendingen** to inspect the answers behind those figures.

The `enquete_resultaten` capability allows reading results, analysis, conclusions
and round comparisons. Configuring profiles, labeling answers, saving conclusions,
editing round comparisons and accessing **Opvolging** also require `enquetes`.

## Selection and denominators

Analysis, CSV export and new conclusions use the same selection. Options within a
question are combined with OR. Filters on different questions are combined with
AND. Text search ignores letter case and matches parts of words. Search text,
open question and confirmed theme must match the same open answer when combined.
Open answers and submissions each have 25 items per page.

Question percentages use the number of selected submissions that answered that
question. A multiple-choice submission can contribute to several options. A
configured metric counts a submission once when it contains any selected option.
Its denominator excludes unanswered submissions and those with any excluded
option. Cross-tabs show both the total in each group and the number who answered
the outcome question. Multiple-choice groups can overlap. The UI flags outcome
groups below ten answers. Rates with a zero denominator are unavailable.

Invitation response uses the full published version before answer filters.
The denominator is invitations with a recorded send. The numerator is those
invitations with a matching stored reply. Reminders add no denominator entries.
Invited and public submissions have separate counts. A public link has no
defined audience size for a response rate.

## Profiles and themes

**Analyse instellen** saves metrics, cross-tabs, saved selections and themes per
published version. Start with a blank profile, the **Vrijwilligersbeleid**
template, or a saved template. Templates are copied into each version. Map
questions and options explicitly. Unmapped metrics and comparisons show a
configuration message, and unresolved saved selections require repair.
Saving a reusable template creates a new private record.

Keyword matches suggest themes for an open answer. An authorized user confirms
or removes the labels. Theme counts include a submission once per confirmed
theme. The version's profile revision and the reply's label revision guard edits
against stale writes with HTTP 409. A label changes analysis metadata only.

Profiles with `context: "volunteers"` offer **Rondo-context** to users who also
have `vrijwilligers` or administrator access. This view reads the club-wide
[volunteer policy dashboard](/features/volunteer-policy/) with its own season
and observation date. Survey filters leave those figures unchanged.

## Conclusions and source references

**Conclusies** saves an immutable report with the author, timestamp, questionnaire
version, calculation version, profile, selection and aggregate evidence. A save
requires the current `profile_revision` and `source_revision`. HTTP 409 prompts
the author to refresh and review the figures before trying again. A correction
creates a new report linked to the previous report for the same version.

Reports can reference a question, theme or selected submission. They store source
references and counts without copying open answers or respondent identity.
Reading a source requires results access and resolves it from current storage.
Deleted sources are marked unavailable. New submissions or other source changes
are flagged while the saved figures retain their original values. Free text in
answers or an author's conclusion may itself contain identifying information.

## Follow-up actions and rules

**Opvolging** tracks internal actions based on a submission, confirmed theme or
conclusion from the selected version. The action keeps the source reference,
title, notes, status, owner and deadline. An owner must be an approved Rondo user
with both survey capabilities. The `open`, `in_progress`, `done` and `no_action`
statuses require an owner and a valid `YYYY-MM-DD` deadline. **Geen actie**
and dismissed proposals require a reason. The list supports status, owner and
overdue filters. Detail includes an audit trail with the author, timestamp and
changed values.

An active rule can match explicit answer options or a confirmed theme. A manual
run scans up to 100 submissions per request, returning `next` for the next
batch. A match creates an unassigned `proposed` action for review. Accepting it
requires an eligible owner, a deadline and an available source. Rules record
their origin by rule ID, rule version and response ID, so rerunning the same
rule version leaves prior decisions intact. Changing its title or predicate
increments the rule version. Proposals stay inside the survey workflow and
trigger neither email nor a general Rondo task.

## Round comparisons

**Rondes** compares a shared measurement across two to ten distinct surveys.
Each round maps one published version to a choice question, included and excluded
options, a period, an audience and a compatibility assessment. The comparison
includes the current survey version. The period and audience describe the round.
Counts use the mapped version's submissions.

The first round is the baseline. Changes in question type or scale size make a
round incompatible. Changes in labels, scale order, option mapping, audience or
question text limit comparability. Limited and incompatible rounds can still
show their own counts and denominators. A percentage-point change appears only
for comparable rounds when both denominators are positive. Denominators below
ten are flagged. Missing sources are shown as unavailable.

## REST contract

Routes use `/wp-json/rondo/v1`. **Read** requires `enquete_resultaten`.
**Manage** requires both survey capabilities. In the table, `{analysis}` stands
for `/surveys/{id}/analysis`.

| Method and path | Right and contract |
| --- | --- |
| `GET /surveys/analysis-profiles` | Read. Built-in and saved profile templates |
| `POST /surveys/analysis-profiles` | Manage. Saves `{ profile }` as a new template |
| `GET {analysis}` | Read. Aggregates, configuration, response totals, selection and source revision |
| `PUT {analysis}` | Manage. Saves `{ version, revision, profile }` |
| `GET {analysis}/texts` | Read. Page of open answers, confirmed themes and keyword suggestions |
| `GET {analysis}/submissions` | Read. Page of selected submissions |
| `GET {analysis}/source` | Read. Resolves `response_id` within this survey, with its published question definitions |
| `PUT {analysis}/labels` | Manage. Accepts `response_id`, `question`, `themes`, `revision` and `profile_revision` |
| `GET {analysis}/reports` | Read. Stored conclusions for the version, with source availability and freshness flags |
| `POST {analysis}/reports` | Manage. Accepts `version`, `title`, `text`, `profile_revision`, `source_revision` and optional `selection`, `references`, `previous` |
| `GET /surveys/analysis-owners` | Manage. Eligible action owners |
| `GET {analysis}/actions` | Manage. Requires `version`; supports `status`, `owner`, `overdue` and `page` |
| `POST {analysis}/actions` | Manage. Saves `version`, `title`, `source`, `status`, `owner`, `due`, `notes` and `reason`. Edits include `id` and `revision` |
| `GET {analysis}/action-detail` | Manage. Requires `version` and `action_id` |
| `GET {analysis}/rules` | Manage. Rules for `version` |
| `POST {analysis}/rules` | Manage. Accepts `version`, `title`, boolean `active` and `predicate`. Edits include `id` and `revision` |
| `POST {analysis}/rules/run` | Manage. Accepts `version`, rule `id`, `revision` and optional `after`. Returns `created`, `processed` and `next` |
| `GET /surveys/analysis-rounds` | Read. Published questionnaire catalog with question definitions |
| `GET {analysis}/rounds` | Read. Comparisons and per-round results for `version` |
| `POST {analysis}/rounds` | Manage. Accepts `version`, `title`, `definition` and `rounds`. Edits include `id` and `revision` |

Filtered reads accept `version`, `view` or `filters`, plus optional `search`,
`text_question` and `theme`. `filters` maps question IDs to arrays of option IDs
and can be JSON-encoded in the query string. The legacy `question` and `value`
pair still selects a single answer option. Individual submissions expose identity
only when the survey was configured to link responses.

## Storage

Profiles per version and reply labels live in protected native fields
`analysis_profiles` and `analysis_labels`. Reusable profiles, conclusions,
actions, rules and comparisons use private, non-exportable posts
(`rondo_survey_profile`, `rondo_survey_report`, `rondo_survey_action`,
`rondo_survey_rule` and `rondo_survey_round`). Per-survey writes use the survey
lock. `SurveyAnalysisTest` and `SurveyFollowupTest` cover selection, denominators,
version and permission boundaries, revision conflicts and retries.
