---
title: Zelf gegevens wijzigen
---

Leden met een gekoppeld persoonsprofiel kunnen via **Mijn gegevens** hun e-mailadressen, telefoonnummers en gezinsadres beheren.

Op de kaart van ieder eigen minderjarig kind staat eveneens **Wijzigen**. Daarmee kan de ouder de e-mailadressen en telefoonnummers van dat specifieke kind beheren. De server accepteert hiervoor alleen het gekoppelde profiel en kinderen binnen de persoonlijke household-scope; de andere ouder/verzorger en personen buiten het gezin blijven alleen-lezen.

## Pagina-indeling en profielfoto

Mijn gegevens toont één persoon tegelijk. De persoonskeuze bovenaan bevat het gekoppelde lid, minderjarige kinderen en de andere ouder/verzorger. Contactgegevens staan standaard open; lidmaatschap, ledenpas/wallets en teamagenda’s zijn uitklapbaar. De contributiestatus van de gekozen persoon blijft direct zichtbaar.

Bij het eigen profiel en minderjarige kinderen staat de profielfoto met **Foto wijzigen** of **Foto toevoegen**. Het bestaande bijsnijvenster laat de gebruiker slepen en zoomen en verstuurt alleen de gekozen vierkante JPEG-uitsnede (maximaal 800 × 800 pixels). De kiezer accepteert JPG, PNG, WebP en GIF tot 5 MB; annuleren verandert niets.

`POST /rondo/v1/people/{person_id}/household-photo` hergebruikt de bestaande foto-opslag, bestandsvalidatie, vergrendeling en Sportlink-fotowachtrij. De server forceert `source=manual`. De route accepteert uitsluitend het eigen gepubliceerde persoonsprofiel of een eigen minderjarig kind; ook beheerders krijgen via deze route geen ruimere toegang. Oud-leden en overleden personen zijn uitgesloten. De bestaande beheerroute `/photo` houdt zijn eigen rechten.

De household-response bevat `thumbnail`, `can_edit_photo` en `photo_sync_status`. Voor de andere ouder bevat `thumbnail` de bestaande profielfoto, of `null` als er geen foto is; `can_edit_photo` blijft `false` en `photo_sync_status` blijft `null`. De foto is zichtbaar in de persoonskeuze en op de kaart, zonder bewerkmogelijkheid. Na opslaan worden de foto en gekoppelde profielweergaven opnieuw opgehaald. Fotoverwerking gebruikt de bestaande PhotoSync-status; het contactwijzigingslog hieronder blijft voor contactgegevens.

## Gezin en andere ouder/verzorger

De persoonlijke household-route toont het gekoppelde profiel, minderjarige kinderen en de andere ouder/verzorger die aan een van die kinderen is gekoppeld. Van die andere ouder worden alleen naam, profielfoto en contactgegevens teruggegeven; de kaart is volledig alleen-lezen en bevat geen ledenpas, sponsororganisatie, geboortedatum, KNVB-ID of VOG-gegevens.

`GET /rondo/v1/people/household` gebruikt een expliciete veldprojectie. De endpoint leest en formatteert alleen de profielvelden die deze pagina toont; voeg nieuwe zichtbare velden daarom aan die projectie toe in plaats van terug te vallen op de volledige persoonsserializer.

Heeft een eigen minderjarig kind nog geen andere ouder/verzorger, dan verschijnt na **Wijzigen** de actie om een nieuwe persoon met naam, e-mailadres en optioneel telefoonnummer toe te voegen. De gewone kindkaart toont deze actie niet. `POST /rondo/v1/people/{child_id}/household-parent` accepteert alleen een kind binnen de persoonlijke household-scope, maakt uitsluitend een nieuwe ouder aan en gebruikt daarna dezelfde relatie-, Sportlink-slot- en synchronisatielogica als de ledenadministratie. Een bestaande persoon koppelen blijft voorbehouden aan de ledenadministratie.

## Contributiestatus

De kaart van het gekoppelde lid en ieder eigen minderjarig kind toont de contributiestatus voor het huidige seizoen zodra de contributiefactuur is verstuurd. Het overzicht vermeldt het totaalbedrag, de betaaltermijn en bij een termijnplan de voortgang en eerstvolgende termijn.

De household-route leest hiervoor alleen contributiefacturen met de status `rondo_sent`, `rondo_paid` of `rondo_overdue`, gekoppeld aan de persoon en het huidige `_invoice_season`. Concept- en vervallen facturen blijven verborgen. Voor een nog niet gekozen betaalplan verwijst de actie naar de bestaande openbare planselectiepagina; bij een actief termijnplan wordt uitsluitend de actuele Mollie-betaallink teruggegeven.

Contributiegegevens volgen dezelfde persoonlijke household-scope als de contactgegevens. Een andere ouder/verzorger die alleen ter context op de pagina verschijnt krijgt altijd `contribution: null`, ook wanneer die persoon zelf een contributiefactuur heeft.

## Mijn VOG

Het gekoppelde lid kan via **Profiel → Mijn VOG** de eigen VOG-status, afgiftedatum en vervaldatum bekijken. `GET /rondo/v1/vog/me` retourneert alleen de gegevens van het gekoppelde persoonsprofiel.

Beheerders stellen onder **Instellingen → VOG** afzonderlijke ledenberichten in voor een ontbrekende, verlopen en bijna verlopende VOG. De instellingen worden als WordPress-opties opgeslagen en de persoonlijke VOG-route levert de actuele teksten mee aan de profielpagina. Een lege instelling valt terug op de standaardtekst.

## E-mail

`email_1` is het primaire e-mailadres en `email_2` het tweede e-mailadres. Een adres toevoegen, vervangen of primair maken wordt pas uitgevoerd nadat de ontvanger de eenmalige link heeft geopend. De link is twee uur geldig en een nieuwe aanvraag maakt een oudere aanvraag ongeldig.

Na verificatie werkt Rondo het persoonsprofiel, het afleveradres van het WordPress-account en bij een primair adres ook het loginadres bij. Gekoppelde minderjarige kinderen worden alleen aangepast wanneer hun betreffende e-mailveld nog exact het oude gezinsadres bevat. Een afwijkend adres van een kind wordt nooit overschreven.

Rondo waarschuwt in beide wijzigformulieren dat het tot een half uur kan duren voordat het nieuwe e-mailadres in Sportlink en Voetbal.nl is verwerkt.

Een e-mailwijziging die de ouder rechtstreeks vanaf de kaart van een kind start, past uitsluitend dat kind aan. Het WordPress-account van de ouder en de gegevens van andere kinderen wijzigen dan niet.

Het tweede e-mailadres kan zonder verificatie worden verwijderd. Het primaire e-mailadres kan alleen worden vervangen of worden gewisseld met het tweede adres.

## Telefoon

Leden kunnen `mobile_1`, `mobile_2`, `telephone_1` en `telephone_2` onafhankelijk toevoegen, wijzigen en leegmaken. De waarden worden als internationale telefoonnummers opgeslagen.

Dezelfde vier velden zijn per minderjarig kind afzonderlijk te beheren vanaf de kaart van dat kind.

`telephone_2` is Rondo-only. Dit veld wordt niet naar Sportlink gestuurd, omdat Sportlink geen betrouwbaar tweede vaste-telefoonveld ondersteunt. De andere drie telefoonslots gaan wel door de normale reverse-sync.

## Gezinsadres

Een adreswijziging vervangt of maakt de adresregel met label `Home` bij het gekoppelde actieve lid en alle zichtbare minderjarige kinderen. Andere adresregels, zoals een factuur- of werkadres, blijven behouden. Voormalige en overleden leden worden niet aangepast.

Land en landcode zijn verplicht. Nederlandse adressen krijgen bij ontbrekende invoer automatisch `Nederland` en `NL`; een buitenlands adres zonder geldige ISO-landcode wordt geweigerd voordat het profiel of de Sportlink-wachtrij wordt bijgewerkt.

## Wijzigingslog

Elke zelfserviceactie maakt een privaat `rondo_profile_change`-record met actor, tijdstip, betrokken personen, oude en nieuwe waarden, verificatiestatus en Sportlink-status. De statussen zijn `pending`, `synced`, `failed`, `action_required` en `local_only`. De UI toont `action_required` als **Actie nodig** met de concrete Sportlink-validatiemelding.

Alleen gebruikers met de capability `ledenadministratie` en beheerders kunnen de log via **Relaties → Wijzigingslog** lezen. Rondo verwijdert logregels na 24 maanden met een dagelijkse retentietaak.

De reverse-sync meldt het resultaat terug via `POST /rondo/v1/profile-change-log/sync-status`. Deze route vereist een beheeraccount, zoals de bestaande Rondo-applicatiegebruiker van de synchronisatie. Een definitieve Sportlink-formuliervalidatie wordt als `action_required` gemeld en blijft herstelbaar; een latere geslaagde retry zet dezelfde logregel alsnog op `synced`.
