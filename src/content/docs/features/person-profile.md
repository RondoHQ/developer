---
title: Person profile layout
---

The **Profiel** tab at `/people/{id}` uses one column on phones, two from the `md` breakpoint and three from `xl`. The main columns are:

1. **Contactgegevens**, including addresses, followed by **Relaties** and configured custom fields.
2. **Lidmaatschap**, **Documenten** and permission-filtered financial information.
3. **Inschrijftaken**, **Taken** and administrator-only **Account** details.

On two-column screens the third column spans the row below the first two. Tasks and account information remain available on narrow Profile screens; other tabs retain their existing sidebar and mobile task button. Only the Profile content uses plain card borders and headings; shared card styles elsewhere are unchanged.

## Profile header

The header uses a plain name, an 88-pixel photo with its existing sync indicator, and matching neutral role badges. Financial blocks have a separate red notice; membership warnings remain amber. Existing roles, team/committee links, demographic details and external service links remain available.

The icon-only pencil at the top right opens `PersonEditModal` under the existing `canEditPeople` gate, including its former-member and deceased restrictions. **Beheerinstellingen** is collapsed initially and exposes `person_type` only to full people editors. Sponsor-only editors retain their existing identity editing scope and cannot change the person type. Saving sends only changed identity fields under the canonical `fields` payload; contact details and dates are not submitted by this editor.

The adjacent **Meer persoonsacties** disclosure contains vCard export, Sportlink refresh for its existing permitted users and administrator-only merging. It closes after a selection, on outside clicks and with Escape. Refresh progress, success and errors remain visible outside the menu. The editor supports Escape, keyboard focus containment, restored focus and accessible field labels.

## Contact and membership

The contact editor uses an icon-only pencil matching address editing, and contact rows have no added vertical gap (`space-y-0`). The existing address add/edit/delete actions, relationship editor and Google Maps links remain available under their existing permissions. A single Dutch home address omits the `Home` label and the country line. Other address labels and foreign countries remain visible.

Membership shows the **Bondsnummer** (KNVB ID), type, joining date, leaving date when present, and team. **Sportlink-gegevens** expands the remaining import fields. An absent membership record does not produce an empty card.

## Documents

VOG visibility still requires VOG access and a current volunteer. IVA appears only with an attached certificate, independently of volunteer status. The entire Documents card disappears if neither section is applicable. When both appear, the divider has equal 16-pixel spacing above and below.

Both sections use `DocumentStatusBadge`: green **Geldig**, amber **Wacht op beoordeling** or **Verlopen**, and red **Ontbreekt**. IVA is valid only with approval and a completion date. VOG validity retains its existing three-year rule. The existing authenticated certificate link and download permissions are preserved.

VOG dates are read-only by default. An icon-only pencil matching the address edit control opens and closes the existing date controls, with an accessible label, tooltip and expanded state; missing/expired VOGs retain application, email and reminder fields. Recorded application progress remains accessible under **Aanvraagstatus** without opening the editor.

## Shifts and administration

Shift obligations show **Vrijgesteld**, **Geen inschrijftaken vereist**, or completed/required progress, without a season label beside the summary. Progress uses the existing server attribution calculator and caps each unit at its requirement for the summary, so surplus personal shifts do not imply that an unfinished family duty is complete. Details retain actual counts per unit, future shifts and the two most recent shifts; empty history sections are omitted.

Open tasks remain visible and can be added from the header. An empty task list is a compact header with **0 open**. Account details, role synchronization and switching users are inside an administrator-only disclosure.
