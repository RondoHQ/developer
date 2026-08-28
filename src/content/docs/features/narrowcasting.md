---
title: "Narrowcasting and Rondo Player"
---

Rondo Club includes the control plane and browser display for subscription-free
club narrowcasting. A Raspberry Pi runs the separate Rondo Player agent behind
each television.

The site-wide Club TV [feature toggle](./feature-toggles/) defaults to `on`. `admin_only` limits the
management UI, content API, and browser-presenter sender to administrators. `off` hides those human
surfaces completely. Paired Raspberry Pi players continue fetching their existing configuration and
playlists in every state, so disabling management does not blank active televisions.

## Implemented scope

The technical pilot, matchday and content milestones provide:

- role-based content and playlist management at `/narrowcasting`;
- an authenticated browser preview at `/display?preview=1`, opened from
  the **Club TV** page without creating a player record or credential;
- a public full-screen browser shell at `/display` that authenticates with a
  device token;
- player configuration, heartbeat, status and predefined-command REST routes;
- per-player stable, beta or disabled automatic-update channels;
- scheduled and manual HDMI-CEC wake and standby through Rondo Player;
- locally cached display configuration and matchday content when the network is
  temporarily down;
- server-side Sportlink Club.Data fetching and normalized feeds for the selected
  matchday's matches, pitches, dressing rooms, cancellations and recent results;
- automatically rotating 16:9 scenes with stale-data and 24-hour expiry states.
- announcements, sponsor cards, images, muted MP4 video and dynamic match scenes;
- weighted playlists with per-item durations, date/day/time schedules, fallbacks
  and display assignments;
- temporary full-screen overrides for every display or selected displays;
- locally cached, resolved player manifests that contain no private sponsor data.
- club-branded playback using the centrally configured club logo, accent colour
  and light background; individual items can explicitly opt into custom colours;
- a browser preview that always selects the nearest Saturday (including the
  current day when opened on Saturday), while paired players select today;
- programme and result rows show both team logos supplied by Sportlink alongside
  the team names; the schedule, pitch and dressing-room assignments are combined
  into one overview per group of matches.
- the display header uses the current scene title beside the unframed club logo;
  match, cancellation, result, announcement and image scenes show the date and
  clock in the lower-right corner;
- image slides scale up to fit the available stage without cropping their
  content;
- up to eight active sponsor-company logos rotate per scene, with three slots in
  the header and five in the footer; compact card padding gives each logo more
  usable space.
- an opt-in browser-presentation flow: an unassigned display allows any signed-in
  Rondo user, while a room-linked controlled display limits its six-digit code
  and session to the active reservation holder and authorized presenters.

The `narrowcasting` capability manages content, playlists and previews. A user
with only `sponsorbeheer` sees and manages sponsor items but cannot edit other
content, playlists, players or Sportlink settings. Administrators additionally
manage players, display assignments and Sportlink. The Club TV interface uses
the shared Rondo tab design for **Content**, **Afspeellijsten**, **Players** and
**Instellingen**. Player cards are shown first on the Players tab; the less
frequent pairing form opens from **Nieuw player koppelen** in a popover.

## Sportlink matchday adapter

The Sportlink client ID is stored in the WordPress Options API and is never
returned after it is saved. The administrator UI only receives a boolean and a
masked placeholder. Club TV browsers call Rondo; they never call Sportlink.

`SportlinkMatchday` requests `programma` and `afgelastingen` at most every five
minutes and `uitslagen` at most every fifteen minutes. It normalizes external
rows into a small public contract and stores only that normalized result as the
last-known-good cache. Failed requests record a credential-free error while
preserving the previous payload. Cached assignments remain playable with a
stale marker for up to 24 hours.

The cron refresh is supplemented by refresh-on-read. This keeps the feed current
even on sites where WordPress cron traffic is intermittent, while a short lock
prevents several players from refreshing Sportlink simultaneously.

## Data model

Players are stored as private `rondo_display` posts. Operational state uses the
native field registry and post meta; there are no custom tables. The post type
is not exposed through the core REST API or WordPress admin UI.

Important fields include:

| Field | Purpose |
|---|---|
| `device_id` | Stable hardware identity derived from the Pi machine ID |
| `device_secret_hash` | HMAC hash of the bearer credential; the raw token is never stored in Rondo |
| `pairing_status` | `approved`, `paired` or `revoked` |
| `last_seen_at` | Durable, rate-limited heartbeat timestamp |
| `wake_time` / `sleep_time` | Local HDMI-CEC schedule |
| `assigned_playlist_id` | Optional screen-specific playlist; otherwise the site default is used |
| `pending_command*` | One bounded, short-lived remote command |
| `update_channel` | `stable`, `beta` or `off`; selects an administrator-approved signed release |
| `presentation_enabled` | Enables the browser-presentation pilot for this display |

Online state is a three-minute transient so a heartbeat does not write post
meta every minute. `last_seen_at` is persisted at most once every five minutes.

Content is stored in private `rondo_signage_item` posts and playlists in private
`rondo_signage_list` posts. Both use the native field registry and numbered
post-meta rows for playlist entries. Media remains a normal WordPress
attachment. Images accept JPEG, PNG and WebP; video accepts muted H.264 MP4 up
to 100 MB.

The server resolves schedules, item weights, fallbacks and active overrides
before returning a manifest. Players therefore do not receive private person
records or scheduling internals. Sponsor scenes and rotating logo slots contain
only the public company name and logo from active `rondo_sponsor` posts. New and
existing items use the central club palette by default through
`use_club_colors`; the stored background, text and accent colours are only sent
to a player when an editor explicitly disables that setting.

The display checks for a fresh manifest every ten seconds, but retains the
current React state when the playlist ID, content version and override state are
unchanged. This keeps slide-duration timers running while still applying real
content changes on the next poll.

## Pairing flow

1. An unpaired player registers its stable `device_id` and receives an
   eight-character activation code that expires after 15 minutes.
2. An administrator opens **Club TV → Players → Nieuw player koppelen**, enters
   that code, names the display and chooses the schedule.
3. The same device exchanges its approved code for a 256-bit device token.
4. The token is written with mode `0600` on the Pi. Rondo stores only an HMAC
   hash made with the WordPress authentication salt.
5. Revoking a display removes its hash immediately, so all device endpoints
   reject the old token.

The activation-code registration endpoints are public by design and
rate-limited by source address. Every management route requires
`manage_options`.

## Signed player updates

Administrators approve one stable version and, optionally, one beta version in
**Club TV → Instellingen**. Each display selects `stable`, `beta` or
`off`. The device configuration exposes only that channel and its target
version; it never accepts a release URL from WordPress.

Rondo Player maps the version to the fixed public
`RondoHQ/rondo-player` GitHub release location. A release contains the player
archive, a SHA-256 manifest and an Ed25519 signature. The embedded public key
must validate the manifest before extraction, and every archive path and member
type is checked before writing files.

Installations use `~/.local/share/rondo-player/releases/<version>` with atomic
`current` and `previous` symlinks. After activation, a separate transient
systemd guard gives the new service two minutes to report healthy. A crash or
startup failure switches `current` back to the previous release and restarts
the player. The same failed target is retried no more than once per six hours.

GitHub Actions publishes signed assets for `vX.Y.Z` tags. Its private Ed25519
key exists only in the `RELEASE_SIGNING_KEY` repository secret; the repository
and every player contain only `rondo_player/release-public.pem`. Key rotation
requires a bridge release signed by the old key that embeds the new public key.

## REST API

All routes use the `/wp-json/rondo/v1/narrowcasting` prefix.

| Method and route | Authentication | Purpose |
|---|---|---|
| `POST /devices/register` | Public, rate-limited | Start or resume pairing |
| `POST /devices/claim` | Activation code + matching device ID | Receive the one-time device token |
| `GET /devices/me/config` | `X-Rondo-Device-Token` | Read safe display configuration |
| `GET /devices/me/playlist` | Device token | Read the resolved, player-safe playlist manifest |
| `POST /devices/me/heartbeat` | Device token | Report health and player version |
| `GET /devices/me/commands` | Device token | Poll one predefined command |
| `POST /devices/me/commands/ack` | Device token | Acknowledge command outcome |
| `POST /devices/me/presentation/session` | Device token | Create a presentation code and receiver token, bounded by an active controlled-room booking when configured |
| `POST /presentation/join` | Signed-in Rondo user, rate-limited | Exchange a visible code after any room-booking entitlement check |
| `GET`, `POST /presentation/sessions/{id}/signal` | Short-lived participant token | Exchange the latest WebRTC offer, answer and ICE candidates |
| `GET /displays` | Administrator | List displays and health |
| `GET /preview` | Club TV access | Return a credential-free sample display configuration |
| `GET /preview/playlist` | Club TV access | Resolve a playlist and include exclusion reasons |
| `GET`, `POST /items` | Club TV editor or sponsor manager | List or create allowed content |
| `POST`, `DELETE /items/{id}` | Club TV editor or sponsor manager | Update or remove allowed content |
| `GET`, `POST /playlists` | Club TV editor | List or create playlists |
| `POST`, `DELETE /playlists/{id}` | Club TV editor | Update or remove a playlist |
| `POST /playlists/{id}/default` | Club TV editor | Set the site-wide default playlist |
| `POST /displays/{id}/playlist` | Administrator | Assign a screen-specific playlist |
| `GET /settings` | Administrator | Read masked Sportlink configuration, feed health and approved player versions |
| `POST /settings` | Administrator | Store Sportlink configuration and/or approved stable and beta player versions |
| `POST /refresh` | Administrator, rate-limited | Force a Club.Data refresh |
| `GET /feeds/matchday` | Device token or administrator | Read normalized matchday content; authenticated previews may request the nearest Saturday with `preview=1` |
| `POST /displays/claim` | Administrator | Approve an activation code |
| `POST /displays/{id}/commands` | Administrator | Queue a predefined command |
| `POST /displays/{id}/revoke` | Administrator | Invalidate a player credential |

The allowed commands are `reload`, `restart_browser`, `reboot`, `shutdown`,
`wake_tv`, `sleep_tv` and `cec_detect`. Shutdown requires an explicit
administrator confirmation in the UI and the Pi must be power-cycled before it
can reconnect. There is intentionally no arbitrary command or shell endpoint.

## Browser presentation

Administrators enable browser presentations per display. An unassigned display
keeps the original pilot behavior for signed-in users. When an administrator
links the display to a room and enables reservation-controlled presentation,
the display creates a six-digit code only during the room's active access
window. The holder or an explicitly authorized presenter opens `/presenteren`,
enters that code and chooses a browser tab, application window or full screen
through the browser's native screen-sharing dialog.

Rondo stores only short-lived session metadata, hashed participant tokens and
the latest sanitized WebRTC signaling snapshots in WordPress transients. It
does not proxy or record the media stream. Audio and video travel directly
between the sender browser and the display browser. The display returns to Club
TV when the sender stops, closes the page or loses the peer connection.

For a controlled room, Rondo rechecks display-room assignment, active booking,
holder or presenter identity, and the effective booking end on every signaling
request. Cancellation or expiry stops the transient session immediately; a
locked successful booking extension moves the boundary. Codes remain
rate-limited to ten attempts per user per minute. Media still uses a direct
WebRTC path, so isolated guest networks may require TURN as a later milestone.

## Browser credential handoff

Rondo Player launches `/display#token=...`. The fragment is not sent in the
HTTP request. The display stores the token locally and immediately removes the
fragment from browser history before requesting its configuration. The player
passes the token again whenever Chromium is restarted.

## Testing

`tests/Wpunit/NarrowcastingTest.php` covers the complete registration, approval,
claim, configuration, heartbeat, command, acknowledgement, browser-presentation
signaling and revocation flow, as well as administrator and device-identity
boundaries.
`tests/Wpunit/NarrowcastingSportlinkTest.php` covers normalization, date
selection, credential redaction, freshness metadata and last-known-good behavior
after Club.Data failures.
`tests/Wpunit/NarrowcastingContentTest.php` covers scheduling, weights,
overrides, sponsor-role boundaries and the player-safe manifest.
