---
title: Zelf gegevens wijzigen
---

Leden met een gekoppeld persoonsprofiel kunnen via **Mijn gegevens** hun e-mailadressen, telefoonnummers en gezinsadres beheren.

## Gezin en andere ouder/verzorger

De persoonlijke household-route toont het gekoppelde profiel, minderjarige kinderen en de andere ouder/verzorger die aan een van die kinderen is gekoppeld. Van die andere ouder worden alleen naam en contactgegevens teruggegeven; de kaart is volledig alleen-lezen en bevat geen ledenpas, sponsororganisatie, geboortedatum, KNVB-ID of VOG-gegevens.

Heeft een eigen minderjarig kind nog geen andere ouder/verzorger, dan biedt **Mijn gegevens** een formulier om een nieuwe persoon met naam, e-mailadres en optioneel telefoonnummer toe te voegen. `POST /rondo/v1/people/{child_id}/household-parent` accepteert alleen een kind binnen de persoonlijke household-scope, maakt uitsluitend een nieuwe ouder aan en gebruikt daarna dezelfde relatie-, Sportlink-slot- en synchronisatielogica als de ledenadministratie. Een bestaande persoon koppelen blijft voorbehouden aan de ledenadministratie.

## E-mail

`email_1` is het primaire e-mailadres en `email_2` het tweede e-mailadres. Een adres toevoegen, vervangen of primair maken wordt pas uitgevoerd nadat de ontvanger de eenmalige link heeft geopend. De link is twee uur geldig en een nieuwe aanvraag maakt een oudere aanvraag ongeldig.

Na verificatie werkt Rondo het persoonsprofiel, het afleveradres van het WordPress-account en bij een primair adres ook het loginadres bij. Gekoppelde minderjarige kinderen worden alleen aangepast wanneer hun betreffende e-mailveld nog exact het oude gezinsadres bevat. Een afwijkend adres van een kind wordt nooit overschreven.

Het tweede e-mailadres kan zonder verificatie worden verwijderd. Het primaire e-mailadres kan alleen worden vervangen of worden gewisseld met het tweede adres.

## Telefoon

Leden kunnen `mobile_1`, `mobile_2`, `telephone_1` en `telephone_2` onafhankelijk toevoegen, wijzigen en leegmaken. De waarden worden als internationale telefoonnummers opgeslagen.

`telephone_2` is Rondo-only. Dit veld wordt niet naar Sportlink gestuurd, omdat Sportlink geen betrouwbaar tweede vaste-telefoonveld ondersteunt. De andere drie telefoonslots gaan wel door de normale reverse-sync.

## Gezinsadres

Een adreswijziging vervangt of maakt de adresregel met label `Home` bij het gekoppelde actieve lid en alle zichtbare minderjarige kinderen. Andere adresregels, zoals een factuur- of werkadres, blijven behouden. Voormalige en overleden leden worden niet aangepast.

## Wijzigingslog

Elke zelfserviceactie maakt een privaat `rondo_profile_change`-record met actor, tijdstip, betrokken personen, oude en nieuwe waarden, verificatiestatus en Sportlink-status. De statussen zijn `pending`, `synced`, `failed` en `local_only`.

Alleen gebruikers met de capability `ledenadministratie` en beheerders kunnen de log via **Relaties → Wijzigingslog** lezen. Rondo verwijdert logregels na 24 maanden met een dagelijkse retentietaak.

De reverse-sync meldt het resultaat terug via `POST /rondo/v1/profile-change-log/sync-status`. Deze route vereist een beheeraccount, zoals de bestaande Rondo-applicatiegebruiker van de synchronisatie.
