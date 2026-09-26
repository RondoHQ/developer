---
title: Communicatieplanning
description: Gedeelde planning voor WhatsApp, nieuwsbrieven en websitepublicaties.
---

Rondo bevat onder **Communicatie** een gedeelde planning voor bestuurscommunicatie. Rondo verstuurt of publiceert de berichten niet zelf: een bestuurslid handelt het werk buiten Rondo af en registreert daarna de werkelijke verzend- of publicatiedatum.

## Toegang

De sectie vereist de capability `communicatie`. Deze is standaard toegekend aan beheerders en de rol `rondo_bestuur`, en kan via de bestaande rechtenmatrix aan andere rollen worden toegekend. De REST API, opmerkingen en afbeeldingsdownloads voeren dezelfde server-side controle uit.

## Items en statussen

Een item bevat een titel, beschrijving, één of meer kanalen, doelgroep, één gedeelde geplande datum, verantwoordelijke, optionele Google Docs-link en maximaal tien JPEG-, PNG- of WebP-afbeeldingen. De kanalen worden per club beheerd onder **Instellingen → Club → Communicatiekanalen**. De eerste drie kanalen zijn WhatsApp, Nieuwsbrief en Website; een beheerder kan bijvoorbeeld LinkedIn toevoegen. Kanaalnamen zijn uniek en behouden bij hernoemen hun vaste ID. Uitzetten voorkomt nieuwe selecties, maar bewaart bestaande items en reeksen.

De open workflow bestaat uit `concept`, `preparing` en `ready`. Concepten vereisen alleen een titel en minimaal één kanaal. Vanaf `preparing` zijn ook beschrijving, geplande datum, doelgroep en verantwoordelijke verplicht. Ieder kanaal heeft een eigen checkbox. Afvinken bewaart de werkelijke datum en registrerende gebruiker per kanaal. Het item wordt pas `sent` wanneer alle geselecteerde kanalen zijn afgevinkt. De totale afhandeldatum is de laatste kanaaldatum. Eén kanaal weer uitvinken heropent het item en bewaart de afhandeling van de overige kanalen. Een afgevinkt kanaal kan pas uit de selectie worden verwijderd nadat het afvinken expliciet ongedaan is gemaakt.

Losse items kunnen worden geannuleerd. Een concrete keer uit een reeks kan worden overgeslagen. Beide blijven voor historie beschikbaar. Dupliceren maakt een onafhankelijk concept met dezelfde kanaalselectie, maar zonder datum, herhaling, opmerkingen of afhandelingsgegevens.

## Zoekveld

Het zoekveld gebruikt de gedeelde combinatie `input input-leading-icon`, zodat het vergrootglas voldoende ruimte houdt naast de placeholder en ingevoerde tekst. Gebruik hiervoor geen losse `pl-*` utility: de algemene `.input`-stijl staat buiten de Tailwind-lagen en overschrijft die padding.

## Herhaling

Een reeks gebruikt een afzonderlijke `rondo_comm_series`-entiteit. Iedere nieuwe keer begint met dezelfde kanaalselectie en lege checkboxen. Wijzigingen kunnen ook worden toegepast op het sjabloon en toekomstige openstaande keren waaraan nog niet is begonnen; gedeeltelijk afgehandelde keren blijven behouden. Iedere geplande keer is een eigen `rondo_comm_item`, zodat statussen, tekst, opmerkingen en afhandeling per keer bewaard blijven.

Maandelijkse herhaling houdt de oorspronkelijke dag als anker. Bij een te korte maand wordt de laatste dag gebruikt; de volgende maand keert terug naar het anker. Jaarlijkse herhaling van 29 februari gebruikt 28 februari in niet-schrikkeljaren. Actieve reeksen worden bij het openen van het overzicht tot twaalf maanden vooruit aangevuld en gebruiken een unieke sleutel per reeks en oorspronkelijke datum om duplicaten te voorkomen.

Een reeks kan worden gepauzeerd en hervat. Toekomstige open keren krijgen tijdens de pauze de status `paused` en worden na hervatten teruggezet. Afgehandelde en historische keren veranderen niet.

## Opslag en API

De post types zijn `rondo_comm_item` en `rondo_comm_series`. Domeinvelden staan in de native field registry. Auditregels en de technische bijlagenlijst zijn interne postmeta; opmerkingen zijn WordPress-comments van type `rondo_communication_note`.

De aangepaste endpoints staan onder `/rondo/v1/communications` en `/rondo/v1/communication-series`. Updates ondersteunen een versiewaarde op basis van `modified_gmt`; een verouderde versie krijgt HTTP 409. Checklistbewerkingen worden per item geserialiseerd; een gelijktijdige bewerking krijgt HTTP 409 en moet opnieuw worden gelezen voordat de gebruiker het opnieuw probeert.

### Kanalen en afhandeling

`POST /rondo/v1/config` accepteert `communication_channels`: een lijst van `{id, label, active}`. Dit vereist beheerdersrechten. Nieuwe kanalen krijgen een ID op de server; laat `id` daarvoor weg. Ontbrekende bestaande kanalen worden inactief gemaakt, niet verwijderd. Alle namen blijven bewaard voor historische items.

Items en reeksen accepteren `channel_ids`, een niet-lege lijst van unieke kanaal-ID’s. De respons bevat daarnaast `channels` met `channel_id`, `label`, `active`, `actual_date`, `completed_by` en `published_url`. Afhandeling wordt alleen via de actie uitgevoerd:

```json
{"action":"complete","channel_id":"website","actual_date":"2026-09-26","published_url":"https://club.example/vrijwilliger"}
```

De datum is optioneel en wordt standaard vandaag in de clubtijdzone. Gebruik `reopen` met hetzelfde `channel_id` om alleen dat kanaal te heropenen. `complete` en `reopen` zonder kanaal zijn alleen compatibel met items met één kanaal. Rechtstreeks `status: sent` instellen kan niet.

De native field registry declareert een genummerde `channels`-repeater op items en reeksen. Reeksen bewaren uitsluitend de selectie; items bewaren ook de afhandeling. Oude `channel`-velden worden bij lezen vertaald naar één rij, inclusief bestaande afhandeldatum en link. De eerste wijziging schrijft de nieuwe vorm; uitlezen alleen migreert geen data. De oorspronkelijke `occurrence_key` blijft behouden bij bewerken, zodat een herhaling niet opnieuw wordt aangemaakt.

Zie [MCP-abilities](../../api/abilities/) voor aanmaken en beheren vanuit Claude en Codex.
