---
title: Editable Sync Schedules
---

The Rondo Sync dashboard exposes **Beheer → Sync schedules** at `/beheer/schedules`. An authenticated dashboard user can enable or disable each automatic pipeline, change its cadence and times, and inspect its next run. Manual runs remain available when a schedule is disabled. Twelve opening windows stay in Rondo Club under **Kassaomzet → Synchronisatie**.

## Configuration and defaults

`lib/schedule-config.js` defines ten allowlisted pipeline identities and command arguments. `data/sync-schedules.json` stores version 1 settings using atomic temporary-file/rename writes with file mode `0600`; newly created data directories use `0700`. A missing file uses defaults; malformed or unsupported configuration fails closed.

| Pipeline ID | Initial schedule (Europe/Amsterdam) | Arguments to `sync.sh` |
|---|---|---|
| `people` | Daily 08:00, 11:00, 14:00, 17:00 | `people` |
| `functions` | Daily 07:30, 10:30, 13:30, 16:30 | `functions` |
| `functions-full` | Sunday 01:00 | `functions --all --with-invoice` |
| `freescout` | Daily 08:00 | `freescout` |
| `freescout-conversations` | Daily 09:00 | `conversations` |
| `teams` | Sunday 06:00 | `teams` |
| `sponsit` | Sunday 10:00 | `sponsit` |
| `player-history` | First day of each month 03:00 | `player-history` |
| `discipline` | Monday 23:30 | `discipline` |
| `reverse` | Every five minutes | `reverse` |

These are fresh-install defaults, not a claim about the server's current saved schedule. Nikki, former-member/manual workflows and Twelve are not members of this editable ten-pipeline configuration. Unrelated cron jobs are preserved during migration.

Every pipeline supports daily, weekly, monthly or interval cadence. Fixed schedules accept one to 24 unique `HH:mm` slots, sorted on save; weekly uses weekday 0–6 and monthly uses day 1–31. Allowed interval minutes are 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30 and 60. Unknown pipelines, arbitrary commands, unexpected settings, invalid dates/times and duplicate slots are rejected.

## Dashboard save contract

`GET /beheer/schedules` uses dashboard session authentication and renders a session CSRF token plus the current SHA-256 configuration revision. `POST /beheer/schedules` is an HTML form endpoint using that session, not the `X-Sync-API-Key` API. Successful saves redirect to `/beheer/schedules?saved=1`.

| Result | Behavior |
|---|---|
| Anonymous request | Redirect to `/login` |
| Missing/wrong session CSRF token | HTTP 403; reload before saving |
| Invalid schedule | HTTP 400; render the submitted draft and error |
| Stale configuration revision | HTTP 409; reload the current configuration |
| Valid save | Persist settings and show confirmation after redirect |

Settings pages do not auto-refresh. Each changed schedule receives `changedAt`; unchanged schedules retain their timestamp. Changes apply from the next eligible minute, rather than launching a slot that started before the save.

## Dispatcher and time rules

One cron entry invokes `scripts/scheduler-tick.sh` every minute. It uses a nonblocking `flock` with `--close`, so detached pipeline children cannot inherit and hold the dispatcher lock. `lib/schedule-dispatcher.js` launches only allowlisted `sync.sh` arguments; the normal per-pipeline locks remain in effect.

`data/schedule-dispatch-state.json` records the last dispatched epoch minute per pipeline before spawning. Repeated ticks/restarts cannot launch the same slot twice. A spawn failure restores the previous state; corrupt state stops dispatch. Missed slots are not caught up after downtime, and a crash between state persistence and spawn can skip that slot.

Fixed times follow Europe/Amsterdam wall time. A nonexistent spring time is skipped; a repeated autumn time runs only at its first occurrence. Monthly dates absent from a month are skipped. Intervals follow elapsed epoch minutes, so they continue consistently across daylight-saving changes.

## Install or migrate cron

Run only on the production sync server at `/home/rondo`, as the `rondo` user, after reviewing and backing up the current crontab:

```bash
sudo -u rondo sh -c 'cd /home/rondo && npm run install-cron'
sudo -u rondo crontab -l
```

The installer still prompts for missing Lettermint configuration. Its Node migration imports timings from this checkout's exact legacy `sync.sh` entries and replaces those ten jobs with the minute dispatcher. Pipelines absent from an existing install are marked disabled. Existing UI configuration is validated and preserved, unrelated jobs remain, and a private `data/crontab-before-schedules-*.txt` backup is written. Unknown, duplicate, month-specific or unsupported legacy expressions stop migration without replacing the crontab. Re-running migration does not duplicate the dispatcher.

The hourly `sync.sh twelve --scheduled` check is preserved separately; it uses the club's opening windows. The Node installer refuses root execution; the shell wrapper delegates installation to `rondo` when invoked as root. Never execute installer, dispatcher or sync pipelines locally.

## Monitoring

`lib/schedule.js` is shared by dispatch, dashboard next/previous-run predictions, overdue email checks and the watchdog. Disabled schedules have no next/previous run, overdue alert or automatic heal. A cadence change suppresses previous-slot overdue checks until the first eligible slot; watchdog run age also uses the newer of the last start and `changedAt`.

Watchdog stale budgets follow the saved cadence: intervals use at least one hour, daily schedules at least 30 hours, weekly schedules 180 hours, and monthly budgets allow long months (including skipped days 29–31). Twelve retains its own opening-window budget. Staleness is reported; it does not itself trigger a sync.

`test/editable-schedules.test.js` covers migration, validation, storage, revisions, dispatch deduplication, no catch-up, disabled schedules and DST/month-end behavior. `test/schedule-web.test.js` covers authenticated form rendering, CSRF, validation, stale saves and persisted readback.
