---
title: Member bank accounts
---

Members can maintain their own IBAN and account-holder name in **Mijn gegevens**. Financial managers and administrators see the same **Bankgegevens** card on an accessible person profile. These are local Rondo fields; they do not create Sportlink reverse-sync tasks.

## Permissions and validation

`PersonBankAccount::can_read()` permits the trusted linked person to read their own published person record, or an administrator/finance manager to read an otherwise visible published person. Read-only financial access and household relationships do not grant access to another person's bank account. Writes reject deceased people and reject former members unless the actor is an administrator.

The canonical registry fields are `iban` and `bank_account_holder`, in the independent `bank` field group. IBAN input is uppercased and whitespace removed, then checked against supported SEPA country lengths and the ISO 13616 mod-97 checksum. The holder can differ from the member's name, has a 70-character limit and cannot contain control characters or HTML delimiters. Strings and `null` are accepted; `null` clears a field. Empty details remain valid profile data but can block a payable monthly settlement.

## REST API

All routes require an approved authenticated user and return `Cache-Control: private, no-store` on success.

| Method and route | Contract |
| --- | --- |
| `GET /rondo/v1/user/profile-bank-account` | Own linked person's `iban`, `bank_account_holder` and `can_edit` |
| `PATCH /rondo/v1/user/profile-bank-account` | Partial JSON containing only `iban` and/or `bank_account_holder` |
| `GET /rondo/v1/people/{id}/bank-account` | Same response after the independent person/bank permission checks |
| `PATCH /rondo/v1/people/{id}/bank-account` | Same partial contract and validation |

Empty or unknown-field PATCH payloads fail with HTTP 400; unauthorized access uses HTTP 403 with `rondo_bank_account`. Generic person `fields` writes are guarded by the same policy before any part of the person changes. The registry validator also enforces it for native field writes.

## Audit and settlements

`_rondo_bank_audit` stores actor, timestamp and changed field names, without old or new bank values. Bank writes and [match-compensation operations](/features/match-compensation/) share a process-scoped lock, so changing payment details cannot race a month closing. A changed account invalidates the live preview fingerprint. Closed batches retain their original account snapshot; later profile edits do not rewrite an existing payment instruction.

The separate `nmbrs_name` field uses the same visibility group, but only administrators and finance managers can edit it through the match-compensation endpoint. It is not a member-editable bank field.

Implementation: `class-person-bank-account.php`, `class-rest-bank-accounts.php`, `class-access-control.php`, the field registry and `BankAccountCard.jsx`. `PersonBankAccountTest` covers own-person access, normalization, clearing, unauthorized/unknown-field writes, former members and audit redaction.
