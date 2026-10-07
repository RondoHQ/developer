---
title: Nieuwsbrieven met Laposta
description: Nieuwsbrieven voorbereiden, als Laposta-concept exporteren en een testmail aanvragen.
---

De nieuwsbriefeditor hoort bij een communicatie-item met het ingestelde nieuwsbriefkanaal. Open **Opslaan en nieuwsbrief bewerken** vanuit de planning; de route is `/communicatie/planning/{id}/nieuwsbrief`. Rondo bewaart de inhoud en maakt of actualiseert een concept in Laposta. Vanuit Rondo kun je daarna één testmail aanvragen. De campagne inplannen en naar de doelgroep versturen gebeurt in Laposta; afhandeling van het planningskanaal blijft een afzonderlijke actie.

## Toegang en configuratie

De editor en API vereisen een goedgekeurde gebruiker met `communicatie`. Het item moet een gepubliceerde `rondo_comm_item` zijn met het ingestelde, actieve nieuwsbriefkanaal. Instellingen en ondertekeningsprofielen vereisen daarnaast `manage_options` en staan op `/communicatie/nieuwsbrief-instellingen`.

Een beheerder stelt de Laposta API-sleutel, een HTML-mailtemplate, de aanhef en het kanaal in. De sleutel wordt versleuteld opgeslagen onder `rondo_laposta_campaign_key`; uitlezen van instellingen geeft alleen `has_key`. Een lege sleutel bij opslaan behoudt de bestaande sleutel. De client blokkeert Laposta-verzoeken op demosites.

Iedere verantwoordelijke heeft een gebruikersprofiel met naam, functie, afzendernaam, afzendadres en antwoordadres. Deze velden zijn verplicht voor een actief profiel. Gebruik een in Laposta goedgekeurd afzendadres. Een optionele handtekeningafbeelding gebruikt een publieke HTTPS-URL en een hoogte van 1–600 pixels, standaard 80.

De template vereist `<head>`, `<body>`, `<unsubscribe>`, `<webversion>` en de placeholders `%%BODY_HTML%%`, `%%HEADING%%`, `%%PREHEADER%%`, `%%SALUTATION%%`, `%%SIGNER_NAME%%` en `%%SIGNER_ROLE%%`. Optioneel zijn `%%DOCUMENT_TITLE%%`, `%%SIGNATURE_URL%%` en `%%SIGNATURE_HEIGHT%%`. Onbekende placeholders, scripts, formulieren en doorverwijzingen worden geweigerd. De template mag maximaal 500.000 bytes bevatten.

## Concept en doelgroep

Onderwerp en titel bevatten maximaal 200 tekens, de optionele preheader 250 en de berichtinhoud 100.000. De verantwoordelijke bepaalt het afzender- en ondertekeningsprofiel. Kies maximaal tien unieke Laposta-lijsten en per lijst expliciet één segment of **De hele lijst**. Een lege selectie betekent niet automatisch de hele lijst.

**Controleren** slaat de huidige wijzigingen op en controleert onderwerp, titel, tekst, profiel, template en de actuele lijsten en segmenten. De review toont afzender en doelgroepnamen; het definitieve aantal ontvangers controleer je in Laposta. Het controletoken is tien minuten geldig, gebonden aan gebruiker en item, en omvat een fingerprint van concept, profiel en configuratie. Export controleert de doelgroep opnieuw; een gewijzigde segmentdefinitie vereist een nieuwe review.

Opslag gebruikt de native velden `newsletter_subject`, `newsletter_preheader`, `newsletter_heading`, `newsletter_body` en de repeater `newsletter_audiences` op het communicatie-item. Een doelgroepregel bevat `list_id`, `segment_id` en `scope` (`all`, `segment` of nog onvolledig). Updates sturen alleen gewijzigde velden onder `fields`, samen met de actuele `revision` uit de GET-respons.

## Afbeeldingen en opmaak

De gedeelde Tiptap-editor ondersteunt alinea’s, koppen (`h2`/`h3`), nadruk, links, lijsten en afbeeldingen. **Afbeelding toevoegen** uploadt via WordPress `/wp/v2/media` en voegt de teruggegeven `source_url` in de berichtinhoud in. Hiervoor gelden de WordPress-uploadrechten. Mailafbeeldingen moeten publiek bereikbaar zijn; dit is geen privébijlage van de planning.

De sanitizer behoudt voor `img` uitsluitend `src`, `alt`, `title`, `width` en `height`. Scripts, event handlers, eigen styles en classes verdwijnen. `javascript:`- en `data:`-afbeeldingen zijn niet toegestaan. In preview en export voegt de renderer vaste inline-opmaak toe, terwijl opgeslagen inhoud zonder die opmaak blijft:

| Onderdeel | Opmaak |
|---|---|
| Afbeeldingen | Maximale breedte 100%, automatische hoogte, blokweergave, 12px boven en onder |
| Koppen | 24px boven, 8px onder, regelhoogte 1,4 |
| Lijsten | 12px onder, 24px inspringing |
| Lijstitems | 4px onder; alinea’s binnen lijstitems zonder extra marge |

De editor gebruikt dezelfde afstanden. De voorbeeldweergave staat in een sandbox met CSP, zonder uitvoerbare scripts of navigeerbare links; alleen HTTPS-afbeeldingen mogen laden. Mailprogramma’s kunnen de uiteindelijke weergave verschillend tonen. De handtekeningopmaak komt uit de ingestelde template, niet uit de berichtrenderer.

## Export en herstel

Export bewaart `_rondo_newsletter_export` met campagne-ID, transactiefase, doelinstellingen, HTML en de laatst gecontroleerde remote toestand. De status in de GET-respons is `local`, `exported`, `changed` of `attention`. Een ongewijzigd, gecontroleerd concept wordt hergebruikt; externe wijzigingen worden met HTTP 409 geblokkeerd. Een ingeplande, verzonden of verwijderde campagne wordt niet overschreven.

Een onzekere campagneaanmaak wordt bij een volgende expliciete poging opgezocht met de opgeslagen unieke referentie. Alleen één passend, bewerkbaar resultaat wordt hergebruikt. Onderbroken updates kunnen uitsluitend worden hervat wanneer de remote instellingen en inhoud overeenkomen met de opgeslagen baseline of het exacte transactiedoel. Laposta-importwaarschuwingen of afwijkende readback voorkomen een geslaagde exportstatus.

## Testmail

**Testmail versturen** wordt beschikbaar na een geslaagde export, zolang het lokale concept geen ongeopslagen wijzigingen heeft. De server controleert de actuele `revision`, de exportfingerprint en de remote instellingen en HTML tegen de laatst gecontroleerde baseline. Een gewijzigd concept, extern bewerkte campagne of ingeplande/verzonden campagne krijgt HTTP 409.

De aanvraag accepteert precies één geldig e-mailadres. Rondo vraagt Laposta om de huidige campagne naar dat adres te testen en wijzigt geen doelgroep, campagne-inhoud, exportstatus of afhandeling in de planning. Een bevestigde aanvraag registreert `newsletter_test_requested` in het auditlog; `status: requested` is geen bewijs dat de mail is afgeleverd.

Bij een timeout, serverfout of ontbrekende bevestiging volgt `newsletter_test_uncertain` met HTTP 502. Er is geen automatische retry: controleer de inbox vóór een nieuwe expliciete aanvraag. Laposta HTTP 429 activeert een gedeelde wachttijd. De beperkte client staat campagne-export en de specifieke testmailactie toe; doelgroepverzending, inplannen, verwijderen en ledenbeheer zijn geblokkeerd.

## REST API

Alle routes gebruiken `/rondo/v1`:

| Methode | Route | Gebruik |
|---|---|---|
| GET | `/newsletter` | Configuratiestatus, kanaal en beschikbare profielen |
| GET / PUT | `/newsletter/settings` | Instellingen lezen of wijzigen, alleen beheerder |
| PUT | `/newsletter/profiles/{user_id}` | Ondertekeningsprofiel wijzigen, alleen beheerder |
| GET | `/newsletter/lists` | Actieve lijsten; cache van 60 seconden |
| GET | `/newsletter/lists/{list_id}/segments` | Segmenten van één lijst |
| GET / PUT | `/communications/{id}/newsletter` | Concept lezen of gedeeltelijk opslaan |
| POST | `/communications/{id}/newsletter/preview` | Tijdelijk concept renderen via `fields`, zonder opslaan |
| POST | `/communications/{id}/newsletter/review` | Opgeslagen `revision` controleren en token ontvangen |
| POST | `/communications/{id}/newsletter/export` | Export uitvoeren met controletoken `token` |
| POST | `/communications/{id}/newsletter/testmail` | Testmail aanvragen met `email` en `revision` |

```json
{"email":"tester@example.org","revision":"actuele-revision-uit-GET"}
```

Een geslaagde testmailaanvraag geeft HTTP 200:

```json
{"email":"tester@example.org","status":"requested"}
```

Onbekende velden en ongeldige adressen krijgen HTTP 400. Verouderde revisies en gelijktijdige wijzigingen krijgen HTTP 409. Opslaan, review, export en testmail delen de `rondo_comm_edit_{id}`-lock met de planning.

## Implementatie en tests

De backend staat in `class-newsletter.php`, `class-newsletter-export.php`, `class-rest-newsletter.php` en `class-laposta-client.php`. De UI staat in `src/pages/Communication/Newsletter.jsx` en `NewsletterSettings.jsx`; berichtopmaak gebruikt `RichTextEditor.jsx` en `.newsletter-editor` in `src/index.css`.

`NewsletterTest` controleert onder meer afbeeldingssanitatie en opslag, kop- en lijstafstanden in preview/export, expliciete doelgroepen, reviewconflicten, herstel zonder dubbele campagne, remote wijzigingen, één testadres, rechten, gedeelde locks en onzekere testmail zonder retry.
