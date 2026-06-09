---
title: Taakuitleg
---

Taakuitleg ("task explanations") are volunteer-facing instructions — how to use and
clean a specific piece of equipment, how a recurring task is done. Each entry is a
rich-text page with inline images, linked to one or more diensttypes. Every published
entry has a printable QR code that points at a public, login-free read page, so a
volunteer can scan a sticker stuck to (for example) a frying pan and read the
instructions on the spot.

## Data model

A single custom post type, `taakuitleg`, registered in
`includes/class-post-types.php`:

| Field | Storage | Notes |
|-------|---------|-------|
| Title | `post_title` | |
| Body (rich text + inline images) | `post_content` | `editor` + `revisions` support; exposed over REST as `content`. Images are uploaded to `/wp/v2/media` and stored inline as `<img>`. |
| Diensttypes | ACF `relationship` field `dienst_types` | `acf-json/group_taakuitleg_fields.json`; returns an array of `dienst_type` post IDs; multiple allowed. |
| Published / modified / author | native WordPress fields | modified date drives "laatst bijgewerkt" on the public page. |

The CPT is `public: false` and `publicly_queryable: false` — it carries **no SEO
surface** and is not exposed through WordPress' own routing. Reading happens through
our own rewrite rule (below); editing happens in the React SPA.

## Two surfaces: edit vs. read

| | Editing | Reading (QR target) |
|---|---------|---------------------|
| Where | React SPA, `/vrijwilligers/taakuitleg` | Standalone page, `/uitleg/{slug}` |
| Auth | Logged in, `vrijwilligers` capability | **None** — public |
| Rendered by | `src/pages/Taakuitleg/*` | `includes/class-public-taakuitleg-page.php` (PHP, no SPA) |

### Editing (SPA)

- List + form pages under `src/pages/Taakuitleg/` (`TaakuitlegList.jsx`,
  `TaakuitlegForm.jsx`), data hook `src/hooks/useTaakuitleg.js`, REST helpers
  `getTaakuitleg` / `createTaakuitleg` / `updateTaakuitleg` / `deleteTaakuitleg` on
  `prmApi` in `src/api/client.js` (standard `/wp/v2/taakuitleg`).
- Routes are gated by `VrijwilligersRoute` (the `vrijwilligers` capability); the nav
  entry in `src/components/layout/Layout.jsx` uses `requiresVrijwilligers`.
- The body uses the shared `RichTextEditor` with the **opt-in `enableImages` prop** —
  this adds a Tiptap `Image` extension and a toolbar upload button. Notes, todos and
  feedback keep the default (no images).
- Saving writes `{ title, content, status: 'publish', acf: { dienst_types: [...] } }`.

### Reading (public page)

`PublicTaakuitlegPage` mirrors the payment landing page pattern: a rewrite rule
`^uitleg/([a-z0-9-]+)/?$` → query var → `template_redirect` handler at priority 0
(before the SPA catch-all at priority 1). It looks the post up by slug, renders only
`publish` status (drafts/trashed → 404), sanitizes the body with `wp_kses_post()`, and
emits a self-contained, print-friendly HTML page with `noindex`. Inline image URLs are
public `/wp/v2/media` uploads, so they load without auth.

`PublicTaakuitlegPage::get_public_url($slug)` is the single source of truth for the
`/uitleg/{slug}` convention; the SPA builds the same URL client-side for the QR code.

## Permissions

Taakuitleg follows the app's shared-access model. `AccessControl::grant_taakuitleg_editing()`
(a `map_meta_cap` filter) lets any user with the `vrijwilligers` capability — or an
admin (`manage_options`) — edit and delete **every** taakuitleg, not just ones they
authored. Everyone else is denied. Reading published entries over REST needs no special
capability.

## QR codes

Generated client-side with the `qrcode` package in
`src/pages/Taakuitleg/QrPrintModal.jsx`. The dialog previews the sticker and prints it
through a hidden iframe (isolated styles, popup-blocker-safe). The QR encodes the public
`/uitleg/{slug}` URL.

## Rewrite-rule flushing

New rewrite rules are normally only flushed on theme activation, which a plain rsync
deploy does not trigger. `rondo_maybe_flush_rewrite_rules()` (in `functions.php`)
flushes once on the first request after a deploy, gated on the
`rondo_rewrite_rules_version` option — bump that constant when adding or changing a
rewrite rule. This is what makes `/uitleg/{slug}` resolve after deploy without a manual
permalink flush.
