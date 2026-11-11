---
title: "Personen samenvoegen"
description: "Veilig dubbele persoonsprofielen combineren met behoud van gekoppelde gegevens"
---

Beheerders kunnen op een persoonspagina **Samenvoegen** kiezen en vervolgens het dubbele profiel opzoeken op naam, e-mailadres, KNVB-ID of exact profielnummer. De zoekopdracht loopt via de server en laadt niet eerst de volledige personenlijst. De dialoog laat daarna kiezen welk profiel blijft bestaan en toont welke gegevens automatisch worden gecombineerd, welke gekoppelde records meeverhuizen en voor welke afwijkende waarden een keuze nodig is.

## Samenvoegregels

- Het gekozen hoofdprofiel blijft gepubliceerd en behoudt bij verschillen standaard zijn waarde.
- Lege velden worden aangevuld vanuit het dubbele profiel. Een lege `lid_tot` betekent doorlopend lidmaatschap. Bij een verschil met een einddatum moet de beheerder kiezen welke waarde blijft.
- Unieke e-mailadressen, telefoonnummers, adressen, relaties, werkhistorie en andere lijstvelden worden gecombineerd.
- `member` blijft het basispersoonstype zodra een van beide profielen lid of ouder is. De sponsorrol wordt onafhankelijk daarvan behouden.
- Verschillende niet-lege KNVB-IDs blokkeren standaard de samenvoeging. Een beheerder kan dit verschil uitdrukkelijk overrulen nadat die heeft gecontroleerd dat beide profielen dezelfde persoon zijn. Het hoofdprofiel behoudt zijn KNVB-ID.
- Verschillende niet-lege Sponsit- of FreeScout-IDs blijven blokkeren. De KNVB-override heft deze controles niet op.
- Twee verschillende gekoppelde WordPress-accounts blokkeren de merge eveneens.

## KNVB-ID uitdrukkelijk overrulen

Bij verschillende KNVB-IDs toont de dialoog beide waarden. De beheerder bevestigt in één vak dat het om dezelfde persoon gaat en dat de gekozen gegevens kloppen. Een wijziging in de profielen, samenvoegrichting, getoonde conflicten of veldkeuzes maakt de bevestiging ongeldig.

De mutatie stuurt `override_knvb_id: true`; zonder deze expliciete waarde blijft het verschil blokkeren. Het hoofdprofiel bewaart beide oorspronkelijke IDs in de `overrides` van zijn `_rondo_person_merge_history`. Het dubbele profiel gaat met zijn eigen KNVB-ID naar de prullenbak. Andere blokkades en verplichte veldkeuzes blijven gelden.

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

### Wedstrijdvergoedingen

Bij verschillende vergoedingsafspraken toont de dialoog per profiel het team, de geldigheidsperiode
en de betaalroute. De beheerder kiest één volledige set, eventueel de lege set. Open
wedstrijdregistraties kunnen met een nieuwe versie naar het hoofdprofiel verhuizen. Een afrekening
met het dubbele profiel, beide profielen in dezelfde registratie of een verwerking die nog loopt
kan de samenvoeging blokkeren. Zie [Wedstrijdvergoedingen](/features/match-compensation/#person-merges).

## Synchronisatie

Ontbrekende stabiele Sportlink-, Sponsit- en FreeScout-IDs worden aangevuld op het hoofdprofiel. Bij de KNVB-override blijft uitsluitend de gekozen KNVB-ID actief. Sponsit zoekt bij iedere run opnieuw op zijn eigen stabiele IDs en blijft daardoor direct aan het hoofdprofiel gekoppeld.

Sportlink-leden en ouders hebben daarnaast een lokaal `rondo_club_id` in `rondo-sync`. Bij een samengevoegd profiel vraagt de people-pipeline het doel op via `GET /rondo/v1/people/{id}/merge-target`. Alleen bij dezelfde KNVB-ID, of een hoofdprofiel zonder KNVB-ID, mag de pipeline de koppeling aanpassen en het hoofdprofiel bijwerken.

Bij een andere KNVB-ID bewaart Sync de oude bron als een inactieve trackingregel met `retired_into_knvb_id`. Die bron mag het hoofdprofiel niet overschrijven of opnieuw worden aangemaakt. Zie [People Pipeline](/sync/pipeline-people/) voor de controles en het behoud van de oude identiteit.

## API

De dialoog gebruikt een preview en een afzonderlijke bevestigde mutatie. Zie [People API](../api/people.md#merge-people) voor de request- en responsecontracten.
