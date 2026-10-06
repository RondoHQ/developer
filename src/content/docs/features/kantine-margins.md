---
title: Kantine purchase invoices and product margins
---

**Kassaomzet → Marges** stores private purchase invoices, ingredient mappings and dated sale prices to calculate theoretical gross margins per consumption. Views cover product margins, purchase invoices and purchase-price history, with a reference date, search, calculation-status filters and lowest-margin sorting.

## Permissions and native storage

Approved users with `kassaomzet` or administrator access can read the catalog and original invoice PDFs. Uploading invoices, recording prices and editing products additionally requires `UserRoles::can_manage_finances()`. The catalog exposes this distinction as `can_write`; read-only users can inspect calculation details.

`MarginRepository` registers two private post types without admin UI or generic REST exposure:

| Post type | Native fields |
| --- | --- |
| `rondo_purchase` | Invoice number, supplier, invoice date, source filename/hash, VAT amount, gross total, revision and numbered `lines` |
| `rondo_kassa_product` | Numeric-string `twelve_id`, product name, active flag, cost status/note, revision, numbered `ingredients` and `sale_prices` |

Definitions live in `includes/config/kantine-margin-fields.php`, merged into the native field registry. Writes use `Fields::update_many_for_post()`, so replacing a recipe removes stale numbered rows. Original PDF bytes are base64 in private `_kantine_pdf_base64` metadata, not public media attachments. Authenticated PDF responses use `Cache-Control: private, no-store`; catalog JSON exposes `has_pdf`, not the bytes.

## Invoice preview and save

The upload flow recognizes Van Altena's fixed PDF layout. It accepts one PDF up to 5 MB and at most 30 pages, validates its invoice date, parses line amounts/deposits/VAT and requires the sum to reconcile to the gross invoice total within one cent. Unsupported layouts or unbalanced invoices return HTTP 400 without creating a purchase record.

A successful preview stores the parsed invoice and original bytes in a user-bound transient for 30 minutes. The returned `token` authorizes saving the preview. The user checks total quantities and units; unknown quantities remain `null`. Previously known packaging multipliers are reused only when the packaging description matches. Partial deliveries require quantity review.

Saving a preview preserves its supplier, dates, line identity and financial amounts. Only `quantity`, `unit`, `units_per_pack` and `note` may change, and the line count must match. Missing, expired or another user's tokens fail. A successful save keeps the preview available for an exact retry until expiry.

Manual purchases can instead supply structured invoice data without a token or PDF. The UI records a price per unit with supplier and invoice reference. All saves validate required invoice data, at most 1,000 lines, allowed units and VAT rates, numeric amounts and reconciliation. Deposits stay separate from ingredient costs.

Supplier plus invoice number identifies a purchase. The source hash is SHA-256 of original PDF bytes, or the normalized lines for a manual record. An existing pair with the same hash returns its ID and `unchanged: true`; changed content returns HTTP 409. Article codes already used by another supplier are rejected: use a supplier prefix rather than colliding identities. Purchase and product writes share the `rondo_kantine_margin_lock`; concurrent writes return HTTP 409.

## Prices, recipes and calculation

Article history retains invoice date, supplier, invoice reference, source filename, unit, packaging and unit price. Repeated article lines within one invoice use a weighted price: line amount divided by total quantity, excluding deposits. Negative credit lines, nonpositive quantities and Emballage, Referentie, Voorheffing, Huur and Transport do not supply ingredient prices. Unknown quantities or inconsistent units make that invoice's article price unavailable.

The selected purchase price is the latest invoice on or before the reference date. A newer unreviewed quantity or unit blocks calculation rather than silently falling back to an older price. Each recipe ingredient needs a positive quantity and a matching unit; no automatic unit conversion is performed.

Sale prices contain `effective_date`, VAT-inclusive `amount`, `vat_rate` (0, 9 or 21) and `source`, with unique dates. The latest effective price on or before the reference date is used. Editing a price changes Rondo only; update Twelve separately. Use a new effective date to preserve the previous sale price. The reference date selects price history, while the current ingredient mapping and cost status remain in use.

```text
sale_net = sale_price / (1 + vat_rate / 100)
cost = sum(ingredient quantity × purchase unit price excluding VAT)
margin = sale_net − cost
margin_percentage = 100 × margin / sale_net
```

Only `ready` (Berekenbaar) and `base` (Basisinkoop) allow calculation, and both still require usable sale and ingredient prices. `mapping`, `recipe`, `portion`, `vat`, `missing` and `excluded` retain an explanation with `cost`, `margin` and `margin_percentage` set to `null`. Missing information never becomes zero cost. Negative calculated margins remain visible.

These are theoretical product margins: deposits, labor, energy, tap loss and waste are excluded. Basisinkoop covers only the mapped main ingredients. Recipes can explicitly add sauces, bread and packaging. The product's configured VAT rate is used, without a 13% flat-rate calculation.

## REST contract

All routes below are relative to `/wp-json/rondo/v1`. Browser requests use the existing authenticated session and nonce.

| Method and route | Contract |
| --- | --- |
| `GET /twelve/margins` | Optional valid `date=YYYY-MM-DD`, default site-local today; `date`, calculated `products`, `articles`, invoice summaries, `statuses`, `units`, `can_write` |
| `POST /twelve/margins/preview` | Multipart `file`; finance permission; `{ token, invoice }` |
| `POST /twelve/margins/purchase` | `{ token, lines }` for a preview, or complete structured invoice; `{ id, unchanged }` |
| `POST /twelve/margins/product` | Complete product with `ingredients` and `sale_prices`; updates require existing `id` and current `revision`; `{ id, unchanged }` |
| `GET /twelve/margins/invoice/{id}/pdf` | Private PDF bytes; kassa read permission; HTTP 404 if no source PDF exists |

Products allow at most 30 ingredients and 300 sale prices. Exact new-product retries for an existing Twelve ID return `unchanged`; different data for that ID requires opening the existing product. Stale revisions and mismatched IDs return HTTP 409; the Twelve ID cannot be changed through an existing record update. The UI preserves unsaved input after errors and refreshes margin queries after saving.

Implementation: `class-kantine-margin-repository.php`, `class-kantine-purchase-parser.php`, `class-rest-kantine-margins.php`, native field definitions and `KantineMargins.jsx`. `KantineMarginsTest` covers native storage/replay, private PDFs, dated prices, recipe quantities, packaging changes, supplier collisions, revision conflicts, permissions and invalid inputs.
