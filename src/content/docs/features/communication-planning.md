---
title: Communicatieplanning
description: Gedeelde planning voor WhatsApp, nieuwsbrieven en websitepublicaties.
---

Rondo bevat onder **Communicatie** een gedeelde planning voor bestuurscommunicatie. Rondo verstuurt of publiceert de berichten niet zelf: een bestuurslid handelt het werk buiten Rondo af en registreert daarna de werkelijke verzend- of publicatiedatum.

## Toegang

De sectie vereist de capability `communicatie`. Deze is standaard toegekend aan beheerders en de rol `rondo_bestuur`, en kan via de bestaande rechtenmatrix aan andere rollen worden toegekend. De REST API, opmerkingen en afbeeldingsdownloads voeren dezelfde server-side controle uit.

## Items en statussen

Een item bevat een titel, beschrijving, kanaal, doelgroep, geplande datum, verantwoordelijke, optionele Google Docs-link en maximaal tien JPEG-, PNG- of WebP-afbeeldingen. Het kanaal is `whatsapp`, `newsletter` of `website`.

De open workflow bestaat uit `concept`, `preparing` en `ready`. Concepten vereisen alleen een titel en kanaal. Vanaf `preparing` zijn ook beschrijving, geplande datum, doelgroep en verantwoordelijke verplicht. Afhandelen zet een item op `sent` en bewaart de geplande datum, werkelijke datum en registrerende gebruiker. Een afhandeling kan worden teruggedraaid.

Losse items kunnen worden geannuleerd. Een concrete keer uit een reeks kan worden overgeslagen. Beide blijven voor historie beschikbaar. Dupliceren maakt een onafhankelijk concept zonder datum, herhaling, opmerkingen of afhandelingsgegevens.

## Herhaling

Een reeks gebruikt een afzonderlijke `rondo_comm_series`-entiteit. Iedere geplande keer is een eigen `rondo_comm_item`, zodat statussen, tekst, opmerkingen en afhandeling per keer bewaard blijven.

Maandelijkse herhaling houdt de oorspronkelijke dag als anker. Bij een te korte maand wordt de laatste dag gebruikt; de volgende maand keert terug naar het anker. Jaarlijkse herhaling van 29 februari gebruikt 28 februari in niet-schrikkeljaren. Actieve reeksen worden bij het openen van het overzicht tot twaalf maanden vooruit aangevuld en gebruiken een unieke sleutel per reeks en oorspronkelijke datum om duplicaten te voorkomen.

Een reeks kan worden gepauzeerd en hervat. Toekomstige open keren krijgen tijdens de pauze de status `paused` en worden na hervatten teruggezet. Afgehandelde en historische keren veranderen niet.

## Opslag en API

De post types zijn `rondo_comm_item` en `rondo_comm_series`. Domeinvelden staan in de native field registry. Auditregels en de technische bijlagenlijst zijn interne postmeta; opmerkingen zijn WordPress-comments van type `rondo_communication_note`.

De aangepaste endpoints staan onder `/rondo/v1/communications` en `/rondo/v1/communication-series`. Updates ondersteunen een versiewaarde op basis van `modified_gmt`; een verouderde versie krijgt HTTP 409 zodat een nieuwere wijziging niet stil wordt overschreven.
