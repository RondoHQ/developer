---
title: "Installment Payments"
---


## Overview

The installment system allows members to pay their membership fee in multiple installments instead of a single payment. Members choose their plan on the [public payment page](/features/payments/#public-payment-page), and the system automatically creates Mollie payment links, sends emails on due dates, and follows up with overdue reminders.

## Payment Plans

Three plans are available:

| Plan | Key | Installments | Admin Fee |
|------|-----|-------------|-----------|
| Full | `full` | 1 | None |
| Quarterly | `quarterly_3` | 3 | Per-installment |
| Monthly | `monthly_8` | Up to 8 | Per-installment |

### Plan Availability

Plans can be toggled per season via `MembershipFees` configuration (`get_installment_plan_3_enabled()` / `get_installment_plan_8_enabled()`).

Additionally, plans are visibility-gated by the number of **available payment dates** — the 23rd of each month from the current date through April 23rd of the season's end year:

- **3 termijnen** — visible only if ≥3 payment dates remain
- **N termijnen** — visible only if >3 payment dates remain; actual count is `min(8, available_dates)`

Per-invoice override: installments can be disabled for a specific invoice via `_disable_installments` post meta.

### Admin Fee

A configurable per-installment administration fee (from `FinanceConfig::get_installment_admin_fee()`) is added to each installment payment. The fee is shown on the plan selection page and included in each Mollie payment amount.

## Installment Meta Schema

All installment data is stored as flat numbered post meta on the `rondo_invoice` post:

| Meta Key | Description |
|----------|-------------|
| `_installment_plan` | Plan key: `full`, `quarterly_3`, or `monthly_8` |
| `_installment_count` | Total number of installments |
| `_installment_N_amount` | Base amount for installment N (excl. admin fee) |
| `_installment_N_admin_fee` | Admin fee for installment N |
| `_installment_N_status` | Status: `pending` → `sent` → `betaald` |
| `_installment_N_due_date` | Due date in Y-m-d format |
| `_installment_N_mollie_payment_id` | Mollie payment link ID (`pl_xxx`) |
| `_installment_N_payment_link` | Mollie checkout URL |
| `_installment_N_sent_at` | Timestamp when initial email was sent |
| `_installment_N_reminder_1_sent_at` | Timestamp when reminder 1 was sent |
| `_installment_N_reminder_2_sent_at` | Timestamp when reminder 2 was sent |
| `_mollie_pid_{pl_xxx}` | Reverse-lookup: maps Mollie ID → installment number (for O(1) webhook matching) |

### Due Date Calculation

Due dates are set to the **23rd of each month**. For the quarterly (3) plan, dates are evenly spaced across available months (first, middle, last). For the monthly plan, dates are sequential from the next available 23rd.

Rounding is handled carefully: the last installment's amount is calculated as the remainder (`total - sum_of_previous`) to avoid drift from repeated rounding.

## Installment Payment Service

**Class:** `Rondo\Finance\InstallmentPaymentService`

Shared service used by both `PublicPaymentPage` (initial payment) and `MollieWebhook` (automatic next-installment creation).

Creates Mollie **payment links** (not regular payments) via `POST /v2/payment-links` — critical because installment links are emailed to members who may open them days later.

**`create_payment(invoice_id, installment_number)`:**

1. Read installment meta (amount + admin fee) or fall back to total_amount for full plan
2. Build description: `Termijn N/M - Factuur {number}` (or just `Factuur {number}` for full)
3. Create payment link with redirect to `/betaling/{token}?betaald=1`
4. Store payment link ID, checkout URL, and reverse-lookup meta on the invoice

## Automatic Next-Installment Creation

When the Mollie webhook confirms an installment payment:

1. Mark the installment as `betaald`
2. Check if **all** installments are now paid → if yes, transition invoice to `rondo_paid`
3. If more installments remain, create the next installment's Mollie payment link via `InstallmentPaymentService::create_payment()`
4. Idempotency: skips if next payment already exists

This means each payment triggers creation of the next payment link, which is then sent to the member via the scheduled email system.

## Email Scheduler

**Class:** `Rondo\Finance\InstallmentScheduler`

A daily WP-Cron sweeper (`rondo_installment_sweeper`) that runs once per day around midnight. It queries all `rondo_sent` invoices with active installment plans (not `full`) and evaluates each installment.

### Decision Tree Per Installment

```
Skip if: no due_date, or status = 'betaald'

status = 'pending' AND today >= due_date
  → Send initial installment email

status = 'sent' AND 21+ days overdue AND no reminder_2_sent_at
  → Send reminder 2 (with BCC to treasurer)

status = 'sent' AND 14+ days overdue AND no reminder_1_sent_at
  → Send reminder 1
```

Reminder 2 is checked **before** reminder 1 because ≥21 days also satisfies ≥14 days.

### Idempotency

- **Transient lock** (`rondo_installment_sweeper_lock`, 5-minute TTL) prevents concurrent sweeper runs
- **Sent timestamps** on each installment prevent duplicate emails
- **Status written before `wp_mail()`** — if the email fails, the status is already updated to prevent retries from sending duplicates
- Each email action is wrapped in try/catch so one failure doesn't stop the sweep

## Installment Email Sender

**Class:** `Rondo\Finance\InstallmentEmailSender`

Handles three types of installment emails, each creating a **fresh Mollie payment link** before composing:

### Email Types

| Method | Trigger | Subject Prefix | BCC |
|--------|---------|---------------|-----|
| `send_installment_email()` | Due date reached | `Termijn N` | No |
| `send_reminder_1()` | 14 days overdue | `Herinnering termijn N` | No |
| `send_reminder_2()` | 21 days overdue | `Tweede herinnering termijn N` | Yes (treasurer) |

### Template Variables

| Variable | Description |
|----------|-------------|
| `{naam}` | Full person name |
| `{voornaam}` | First name |
| `{factuur_nummer}` | Invoice number |
| `{termijn_nummer}` | Current installment number |
| `{totaal_termijnen}` | Total number of installments |
| `{termijn_bedrag}` | Formatted amount incl. admin fee (e.g. `€ 42,50`) |
| `{betaallink}` | Styled HTML anchor to Mollie checkout |
| `{vervaldatum}` | Dutch long date (e.g. `25 november 2025`) |
| `{organisatie_naam}` | Organization name |
| `{dagen_te_laat}` | Number of days overdue |

Each email type has its own configurable HTML template in `FinanceConfig`.

## Installment Lifecycle

```
Invoice created (rondo_draft)
  ↓
Member visits /betaling/{token}
  ↓
Selects plan → installment meta written
  ↓
Mollie payment created for installment 1
  ↓
Member pays → webhook marks installment 1 as betaald
  ↓
Next installment payment link auto-created
  ↓
Scheduler sends email on due date (status: pending → sent)
  ↓
Member pays → webhook marks installment N as betaald
  ↓
If all paid → invoice transitions to rondo_paid
  ↓
If overdue → reminder 1 at 14 days, reminder 2 at 21 days
```

## Related Documentation

- [Invoicing](/features/invoicing/) — Invoice lifecycle and bulk creation
- [Payments](/features/payments/) — Mollie integration and public payment page
- [Membership Fees](/features/membership-fees/) — Fee calculation and season settings
