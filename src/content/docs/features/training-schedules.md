---
title: "Training schedules"
---

The **Teams → Trainingsschema** page plans recurring weekly training blocks. Administrators can create
several independent, named versions per season, such as **Regulier** and **Slecht weer**, and copy
an existing version as a starting point. Exactly one saved version can be active for team pages.
There are no date-specific exceptions or automatic weather decisions.

## Access

The `training` feature toggle defaults to `admin_only`. Both the frontend and every training API
route enforce it. Setting it to `off` denies everyone, including administrators. Setting it to `on`
makes **all saved versions publicly readable through the training API**. Management and settings
remain restricted to `manage_options` in every state. No player or parent contact data is exposed.

## Settings

**Instellingen → Training** contains:

- Named pitches. Each has a stable identifier and four quarters, A–D. Half pitches are AB or CD;
  a full pitch occupies ABCD. Pitch names can change without breaking existing blocks.
- Named age-group defaults for duration and pitch size.
- Explicit age-group assignments per team, with optional duration and size overrides. Empty
  overrides inherit the age-group default. Without a configured default, new blocks use 60 minutes
  and a quarter pitch; the administrator can change these values before saving.

The first team selected in a new block supplies its defaults. Shared blocks have one duration and
one pitch allocation, which the administrator can adjust for the participating teams. Changing
settings never resizes or moves existing blocks. A pitch used by any saved version cannot be removed.

## Planning

Use the drag handle to move a block between pitches, pitch parts, and times. The grid snaps to
15-minute intervals. Choose **Hele week** for all days, or select a single day. Clicking a block opens
an accessible form for changing its day, time, duration, pitch, and participating teams; the form
also supports touch and keyboard use. A standalone block requires a label, such as keeper training.

The editor marks overlapping blocks and disables saving until the conflicts are resolved. The server
independently rejects concurrent use of the same pitch part or team within the same version. Adjacent
slots and independent versions may use the same resources. Multiple teams may explicitly share one block.

Changes remain local until **Schema opslaan**. Copying, activating, and deleting require a saved version.
Only an inactive version can be moved to WordPress trash. Identifiers remain unchanged when a version
is renamed. Editing an active version updates the training times presented to teams when saved.

## Team pages and API

**Team** and **Mijn team** show every block linked to that team in the active version, including its
name, season, weekday, times, pitch, and pitch parts. Both use the same reusable component and poll
for changes every 30 seconds while open. The UI obeys the feature toggle, including during the admin pilot.

See [Training API](../../api/training-schedules/) for the endpoints and payloads.

## Storage and concurrency

- `rondo_training`: private, non-public CPT without the generic WordPress REST endpoint.
- Post title: version name. The immutable numeric post ID is the version identifier.
- Native registry fields: `season`, `revision`, and the `blocks` repeater.
- Repeater children: `block_id`, `label`, `team_ids`, `pitch_id`, `day`, `start`, `duration`, `size`, `offset`.
- `rondo_training_settings`: site-wide pitch, age-group, team-override configuration and its revision.
- `rondo_training_active`: active version ID, initially zero.

Writes use WordPress APIs and `Rondo\Fields\Fields`. Repeaters use the native count and numbered
metadata layout, including stale-row cleanup. One Options API lock serializes management requests;
revision checks reject stale saves, activations, settings updates, and deletes with HTTP 409.

Key files: `includes/class-training-schedules.php`, `includes/class-rest-training.php`,
`src/pages/Training/`, `src/hooks/useTraining.js`, and `src/components/TeamTraining.jsx`.
