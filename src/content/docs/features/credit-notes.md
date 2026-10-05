---
title: Linked credit notes and injury restitution
---

Finance managers can create a credit draft from an original invoice or calculate contribution restitution for a long injury. Both workflows first display a server-calculated preview, then **Opslaan als concept**. Sending happens separately on the invoice detail page. A refund must be carried out separately; creating or sending a credit does not transfer money or change the original invoice's payment status.

## Ordinary linked credit

**Creditnota maken** is available on normal invoices with status `sent`, `paid` or `overdue`, and opens `/financien/facturen/nieuw?creditFrom={invoice_id}`. Enter a positive amount and a reason. The server creates a negative line, copies the original customer fields and links the credit to the source invoice. Drafts, cancelled invoices and other credits cannot be the source.

The available amount is the original invoice total minus the absolute amounts of all non-cancelled linked credits. Existing drafts reserve this amount too. The source detail displays **Gekoppelde creditnota’s**, and the credit detail displays its original invoice and recorded calculation.

## Injury restitution

**Creditnota bij blessure** opens `/financien/facturen/nieuw?injuryPerson={person_id}&season=2025-2026` from the person's financial card or a membership invoice. `CreditNotes` enforces these conditions against [stored season history](/features/financial-history/):

- The July–June season has ended, and both injury dates fall inside it.
- Inclusive injury days exceed half the season; exactly half is insufficient.
- The complete season contribution is demonstrably paid. An unknown Nikki balance is insufficient.
- The submitted confirmation is boolean `true`. The form asks the trainer/coordinator to confirm the long absence and that this injury was not already compensated in an earlier season; this remains a human declaration.
- The manager chooses numeric `25`, `50`, `75` or `100` percent and costs of at least €50. Rondo does not choose the percentage.

For Rondo contribution data, select a fully paid, normal membership invoice for that person and season. If several exist, the calculation uses the selected invoice's amount after checking payment of the whole season contribution. For Nikki data, use `source_invoice_id: 0`; no original invoice is fabricated.

The credit is `round(basis × percentage / 100) − costs`, calculated in integer cents. It must be positive and fit within the remaining source amount. The draft contains a negative restitution line and a positive cost-withholding line. For example, €200 × 75% − €50 gives a €100 credit. Any non-cancelled injury credit for the same person and season blocks another injury credit with HTTP 409, including an existing draft.

## REST API

Both endpoints accept JSON and require `financieel`; read-only finance access cannot preview or create credits. Person visibility is checked separately.

| Method and route | Behavior |
| --- | --- |
| `POST /rondo/v1/invoices/credits/preview` | Validate source and conditions, return the calculated amount and lines without creating an invoice |
| `POST /rondo/v1/invoices/credits` | Recalculate and create a `rondo_draft`; return `{ "id": ... }` |

Ordinary preview input:

```json
{
  "source_invoice_id": 42,
  "amount": 50,
  "reason": "Contribution correction"
}
```

Injury preview input:

```json
{
  "mode": "injury",
  "person_id": 7,
  "season": "2025-2026",
  "source_invoice_id": 42,
  "injury_start": "2025-09-01",
  "injury_end": "2026-06-30",
  "percentage": 75,
  "costs": 50,
  "conditions_confirmed": true
}
```

Preview responses include `person_id`, `source_invoice_id`, `source_invoice_number`, nullable `season`, `reason`, positive `amount`, `available` and signed `line_items`. Injury previews also include `mode`, `paid_contribution`, `percentage`, `costs`, dates, inclusive `injury_days`, `conditions_confirmed` and the configured `policy_url`.

Creation adds a required `request_id` of 16–80 ASCII letters, digits or hyphens; a UUID is suitable. The UI also sends `expected_amount` from the preview. A changed amount returns HTTP 409 before creation. Replaying the exact request as the same user returns the existing ID; reusing that key for different input returns HTTP 409. A site-specific kernel file lock serializes creation on the host and releases on process exit. Invalid inputs normally return HTTP 400; concurrent creation, duplicate injury credits or request-key conflicts return HTTP 409.

## Rabobank refund export

A sent, open credit (`rondo_sent` or `rondo_overdue`) can produce a private Rabobank `pain.001.001.09` payment file from the invoice detail page. Draft, paid and noncredit invoices are blocked. The exported payment is the absolute credit amount in integer cents, including legacy credits stored with a positive total. Exporting does not send a bank instruction or mark the credit paid; record the refund separately after external processing.

`GET /rondo/v1/invoices/{id}/sepa-export` returns `amount_cents`, `blocked_reason`, payment `defaults`, an existing-export summary and `today`, without creating a file. `POST` requires `confirmed: true`, integer `expected_amount_cents`, a 16–80-character `request_id`, and strings `creditor_name`, `creditor_iban`, `debtor_name`, `debtor_iban`, `execution_date`. Both routes require finance-management access and return `Cache-Control: private, no-store`; finance readers cannot inspect these bank details.

The club account defaults to the invoice's snapshotted payment account and must be a valid Dutch Rabobank IBAN. The recipient requires a valid supported SEPA IBAN different from the debtor and a nonempty name of at most 70 characters. Execution dates range from today through one year ahead. Prefill checks the original invoice's direct Mollie payer details and **paid** installment payer details, including a one-installment contribution payment. One distinct valid account can be prefilled; multiple accounts, missing data or an unlinked credit leave the recipient account unknown for manual verification. A known customer/member name can still prefill the holder field. No old payments are backfilled automatically.

A per-invoice file lock serializes creation. `_credit_sepa_export` stores the complete XML, export ID, amount, payment details, actor and fingerprint before the response. Exact-request retries recover identical bytes/IDs. An explicit repeat download supplies `previous_export_id` and returns the stored instruction; it does not apply newly entered details. Changed totals or a closed credit block even an existing export. Response fields are `xml`, `filename`, `export_id` and `created_at`; files are not written to public uploads.

`CreditSepaExport`, shared `SepaCreditTransfer`, `CreditSepaExport.jsx` and `CreditSepaExportTest` cover XML schema validation, payer ambiguity, permissions, confirmations, concurrency and lost-response/repeat-download behavior. The Mollie webhook preserves available payer names/accounts under direct `_mollie_*` or per-installment `_installment_{N}_mollie_*` metadata without blocking payment registration when details are absent.

## Stored audit and draft controls

Credits use the existing `rondo_invoice` CPT with `invoice_type: manual` and `invoice_kind: credit`, not a new table. Metadata retains `_credit_source_invoice_id`, `_credit_reason`, `_credit_calculation`, `_credit_input`, `_credit_created_by`, `_invoice_season`, `_credit_request_id` and `_credit_request_fingerprint`. Detail responses add `credit_source_invoice_id`, `credit_calculation` and `linked_credits`; invoice responses expose nullable `season`.

A calculated credit cannot be edited through generic draft-detail or add-line endpoints (`credit_locked`, HTTP 409). Delete the draft and calculate a replacement. Sending rechecks the stored inputs, source payment, reserved amount, person, invoice kind and line total while excluding the draft's own reservation. Changed financial data blocks sending. A cancelled calculated credit cannot be reopened (`credit_cancelled`, HTTP 409).

Credits receive no Mollie or Rabobank payment link (`credit_no_payment_link`, HTTP 400), no payment reminder and no automatic overdue transition. Sending and resending skip payment-link creation. Credit PDFs omit payment instructions, payment sections and QR images, including unpaid credits. The normal PDF/email delivery workflow remains in use.

Implementation: `class-credit-notes.php`, `class-person-finance-history.php`, `class-rest-invoices.php`, `useCreditDraft.js`, `CreditNoteForm.jsx`, `InjuryCreditForm.jsx` and `CreditPreview.jsx`. `PersonFinanceHistoryTest` covers replay, reservations, permissions, calculation boundaries, Nikki data, source changes before sending, draft locks and credit payment protections.
