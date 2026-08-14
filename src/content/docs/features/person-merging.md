---
title: "Personen samenvoegen"
description: "Veilig dubbele persoonsprofielen combineren met behoud van gekoppelde gegevens"
---

Beheerders kunnen op een persoonspagina **Samenvoegen** kiezen en vervolgens het dubbele profiel opzoeken op naam, e-mailadres, KNVB-ID of exact profielnummer. De zoekopdracht loopt via de server en laadt niet eerst de volledige personenlijst. De dialoog laat daarna kiezen welk profiel blijft bestaan en toont welke gegevens automatisch worden gecombineerd, welke gekoppelde records meeverhuizen en voor welke afwijkende waarden een keuze nodig is.

## Samenvoegregels

- Het gekozen hoofdprofiel blijft gepubliceerd en behoudt bij verschillen standaard zijn waarde.
- Lege velden worden aangevuld vanuit het dubbele profiel.
- Unieke e-mailadressen, telefoonnummers, adressen, relaties, werkhistorie en andere lijstvelden worden gecombineerd.
- `member` blijft het basispersoonstype zodra een van beide profielen lid of ouder is. De sponsorrol wordt onafhankelijk daarvan behouden.
- Een verschil tussen twee niet-lege stabiele IDs van hetzelfde externe systeem blokkeert de merge. Dit voorkomt dat twee echte Sportlink-, Sponsit- of FreeScout-identiteiten per ongeluk worden samengevoegd.
- Twee verschillende gekoppelde WordPress-accounts blokkeren de merge eveneens.

## Gekoppelde gegevens

`PersonMergeService` verplaatst alle bekende verwijzingen van het dubbele profiel naar het hoofdprofiel:

- bidirectionele persoonsrelaties;
- inschrijftaken en persoonsgebonden shiftmetadata;
- todos;
- tuchtzaken en facturen;
- kledinguitgiftes;
- notities, activiteiten en e-maillogs in WordPress comments;
- bijlagen, profielfoto en het gekoppelde WordPress-account.

Na de migratie wordt het dubbele profiel naar de WordPress-prullenbak verplaatst. Het wordt niet permanent verwijderd. Het hoofdprofiel krijgt een `_rondo_person_merge_history`-auditregel; het dubbele profiel bewaart het doelprofiel, tijdstip en de uitvoerende beheerder in postmeta.

## Synchronisatie

De stabiele Sportlink-, Sponsit- en FreeScout-ID's verhuizen mee naar het hoofdprofiel. Sponsit zoekt bij iedere run opnieuw op zijn eigen stabiele IDs en blijft daardoor direct aan het hoofdprofiel gekoppeld.

Sportlink-leden en ouders hebben daarnaast een lokaal `rondo_club_id` in `rondo-sync`. Wanneer dat ID naar een samengevoegd profiel wijst, vraagt de people-pipeline het actuele doel op via `GET /rondo/v1/people/{id}/merge-target`, past de lokale koppeling aan en werkt het hoofdprofiel bij. Daardoor wordt een samengevoegd profiel niet bij een volgende synchronisatie opnieuw aangemaakt.

## API

De dialoog gebruikt een preview en een afzonderlijke bevestigde mutatie. Zie [People API](../api/people.md#merge-people) voor de request- en responsecontracten.
