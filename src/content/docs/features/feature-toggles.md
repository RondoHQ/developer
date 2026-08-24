---
title: "Feature toggles"
---

Rondo Club has site-wide feature toggles for **Ruimtes**, **Kleding**, and **Club TV**. An
administrator manages them at **Settings → Beheer → Feature toggles**.

Each toggle has three states:

| State | Behaviour |
|---|---|
| `on` | Users with the feature's normal capability can see and use it. |
| `off` | The feature is hidden and its human-facing REST routes deny access, including for administrators. |
| `admin_only` | Only administrators can see and use the feature, so they can configure it before launch. |

States are stored together in the `rondo_feature_toggles` WordPress option. Kleding and Club TV
default to `on` to preserve existing installations. Ruimtes defaults to `off`; until the new option
contains a Rooms state, the legacy `rondo_rooms_enabled` option is used as a compatibility fallback.

The frontend receives the effective state map as `rondoConfig.featureToggles`. Route guards and the
sidebar evaluate the same states as the REST permission callbacks. Changing a toggle through the UI
reloads the app so cached user capabilities and navigation cannot retain the old state.

Club TV device endpoints remain operational in every state. Existing Raspberry Pi players can keep
fetching configuration and playlists while the human management interface is disabled or limited to
administrators.

The administrator API is `GET` and `PUT /wp-json/rondo/v1/settings/feature-toggles`; `PUT` accepts a
`states` object with complete or partial values.
