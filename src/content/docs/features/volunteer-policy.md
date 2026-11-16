---
title: Volunteer policy dashboard
---

**Vrijwilligers → Statistieken → Beleid** shows shift coverage, progress against
volunteer obligations and daily historical figures for the selected season.
The current figures are calculated when the statistics load.

## How the figures are calculated

| Measure | Calculation |
| --- | --- |
| Shift fill rate | Valid assignments divided by available slots on published, non-cancelled season shifts |
| Units on track | Non-exempt player or family units with enough completed and scheduled duties to meet their own requirement |
| Units yet to start | Non-exempt units with a positive requirement and zero completed or scheduled duties |
| Completed and covered duties | Completed duties, and completed plus scheduled duties, each capped at the unit's own requirement |
| Open required duties | Total required duties minus covered duties |
| Maximum coverage from obligations | Required duties divided by shift capacity, capped at 100% |

Percentages for units use the number of liable units. Percentages for completed
and covered duties use the total required duties. Zero denominators return
`null`. The calculation respects exemptions and the [obligation rules](/features/vrijwilligersplicht/)
for families, entrants, no-shows and task credits. Task credits contribute to
obligation progress. Shift fill counts assignments to actual slots.

The cost calculator multiplies editable hours per task and hourly cost by the
base requirement or by the outstanding required duties. The defaults are three
hours and €20 per hour. These inputs are local to the view and serve as a cost
illustration.

## API and history

`GET /rondo/v1/volunteer-statistics?season=2026-2027` requires volunteer-section
access and defaults to the current season. The response includes live `policy`
and `policy_history` alongside `season` and `generated_at`. The policy carries
counts, percentage values and `definition_version`. Historical rows use the same
policy fields plus `date` and `generated_at`. The dashboard flags observations
calculated under a different definition.

The daily WordPress event `rondo_volunteer_policy_snapshot` stores one aggregate
observation per site-local day in the non-autoloaded option
`rondo_volunteer_policy_history_{season}`. It retains up to 366 observations per
season. A process lock prevents concurrent captures from replacing an existing
day. The event is removed when the theme deactivates. History starts with the
first successful capture and a statistics read leaves it unchanged.

The same dashboard can appear as [Rondo-context](/features/survey-analysis/#profiles-and-themes)
in an authorized survey analysis. It uses club-wide statistics with an
independent season selector and observation time.
