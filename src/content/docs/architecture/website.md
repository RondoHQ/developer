---
title: Marketing website
---

The `website` repository contains the bilingual public site at `rondo.club`. It uses Astro, Tailwind CSS and Cloudflare Pages, with Pages Functions under `functions/api/`. Dutch routes live at the root and English routes under `/en/`; shared translations live in `src/i18n/translations.ts`.

## Shared layout and assets

`BaseLayout.astro` supplies metadata, monitoring and the site shell. `Header.astro`, the section components, `RolePage.astro` and the shared UI components apply the same design across homepages, ten role paths, contact and legal pages. The homepage hero uses the committee screenshot in a native modal dialog; product stories and the existing categorized screenshot gallery provide further examples.

Design tokens in `src/styles/global.css` define heading/body colours, surfaces, buttons, gradients and content width. Figtree is self-hosted at weights 400/600/700/800. `public/design/` contains permanent artwork and logos; `docs/design/figma-assets.json` records their source nodes and hashes, and `docs/design/figma-implementation.md` records the design adaptations. Keep product copy and translations authoritative when adapting reference artwork.

The header switches to a collapsible menu below 1100px; Escape closes it and returns focus to the menu button. Homepage hero and product rows stack below 900px. Shared role-page heroes stack below 960px, and role cards reduce to one column at 600px. The skip link appears on keyboard focus, focus outlines are global, and decorative artwork is hidden from assistive technology. `ProductStory` assigns its full-size lightbox image only when opened, avoiding an initial hidden-image download.

## Contact submission

`ContactForm.astro` posts form data to `/api/contact`. The Turnstile script is loaded by the form component, rather than by every `BaseLayout`. The browser resets the Turnstile widget after every attempted request, including mail failures, because site verification can consume the token before delivery fails. Visitors can retry without reloading.

The Function applies a honeypot and three-second timing check, then verifies the token with `TURNSTILE_SECRET_KEY`. Optional `RATE_LIMIT` KV allows five attempts per hour per IP. The Function also validates required name, email and club fields plus length limits. It sends plain-text mail through Lettermint using runtime `LETTERMINT_API_KEY`, `FROM_EMAIL` and `RECIPIENT_EMAIL`; the submitted address becomes `reply_to`.

Malformed requests, missing/invalid tokens and field validation return 400; rate limits return 429. Honeypot/timing rejections return a success-shaped response without sending mail. Operational exceptions and mail-provider rejection return 500. Successful provider acceptance returns 200, which does not prove inbox delivery.

## Diagnostics and performance

Browser monitoring runs only on `rondo.club` and `www.rondo.club`. The SDK reports browser exceptions and contact request failures without form values or original exception messages. Pages middleware captures operational failures with one allowed stage: `form-data`, `turnstile`, `rate-limit` or `email`; browser contact failures use `contact-browser`. Ordinary validation errors, invalid visitor tokens, rate limits, honeypot rejections and successful sends do not generate operational error reports. Turnstile configuration/service failures do. Mail rejection reports status without reading or logging the provider response body.

Browser performance samples 10% of page loads, disabled at build time with `PUBLIC_GLITCHTIP_PERFORMANCE=false`. Contact POST tracing uses fixed Turnstile/mail spans and a separate soft 1,000-per-day `PERFORMANCE_BUDGET` KV counter; unavailable KV drops traces. Runtime `GLITCHTIP_PERFORMANCE=false` disables Function traces. Error reporting remains enabled.

Browser envelopes use `/api/diagnostics`, which bypasses the monitoring middleware to prevent recursion. It validates origin, size, project and item type, and has separate diagnostic counters in the same KV namespace. `GLITCHTIP_TUNNEL=false` disables this transport. See [Error monitoring](/architecture/error-monitoring/) for the full privacy, budget, response and storage contracts.

## Build and validation

`npm run build` runs Astro checks and generates the static site; `npm test` exercises monitoring privacy, release/package alignment, contact failures, performance limits and diagnostics forwarding. `npm run build:functions` checks the Pages Functions bundle with Node compatibility. The monitoring release constant must match `package.json` and remain plain JavaScript for Pages bundler compatibility.

`wrangler.toml` declares the `rondohq-website` Pages project, `dist` output, `nodejs_compat` and the `PERFORMANCE_BUDGET` KV binding. Keep the mail and Turnstile runtime secrets in Pages configuration. Website deployment requires an explicit request; its `npm run deploy` command builds and publishes the `main` branch. Documentation maintenance does not deploy this source repository.
