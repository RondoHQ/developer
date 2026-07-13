---
title: "Externe contacten en sponsors"
---

Rondo Club bewaart externe verenigingscontacten in hetzelfde WordPress `person`-posttype als leden en ouders. Daardoor kunnen contacten direct dezelfde adressen, onderlinge relaties, notities, taken en factuurkoppelingen gebruiken. Er is geen apart contactregister of aangepaste databasetabel.

Businessclubleden en sponsoren gebruiken hetzelfde model met `person_type = sponsor`. Ook zij kunnen een persoonsnaam, bedrijfsnaam of beide hebben. Het selectveld `sponsor_pass_variant` maakt onderscheid tussen `businessclub` en `awc_sponsor`.

## Contact toevoegen

Een gebruiker met rechten om personen te beheren kan op **Relaties** de knop **Contact toevoegen** gebruiken. Het nieuwe record krijgt in ACF `person_type = contact`. Na het opslaan opent de persoonspagina, waar adressen en relaties kunnen worden toegevoegd.

De knop en het achterliggende WordPress REST-endpoint vereisen personenbeheer. Dit is beschikbaar voor beheerders en rollen met `ledenadministratie`, `fairplay`, `vog` of de schrijvende capability `financieel`. Een gewone gebruiker of een rol met uitsluitend `financieel_read` kan geen contact aanmaken.

Deze dialoog is uitsluitend voor externe contacten. Leden en ouders/verzorgers worden via Sportlink toegevoegd en bijgewerkt; daarom kan het persoonstype tijdens het aanmaken niet worden gewijzigd naar lid/ouder.

Een contact kan een persoonsnaam, een bedrijfsnaam of beide hebben. Bij een contact zonder persoonsnaam wordt `company_name` de WordPress-posttitel en daarmee de weergavenaam in lijsten en zoekvelden. De REST API weigert alleen records waarbij zowel `first_name` als `company_name` leeg zijn.

Omdat contacten handmatig worden beheerd, zijn voornaam, tussenvoegsel en achternaam in de aanmaakdialoog bewerkbaar. De Sportlink-beperking op het tussenvoegsel geldt alleen voor gesynchroniseerde leden.

Als een contact zowel een bedrijfsnaam als een contactpersoon heeft, blijft de persoonsnaam de weergavenaam en wordt het bedrijf eronder getoond. Facturen en factuur-PDF's gebruiken de bedrijfsnaam als klantnaam; e-mails gebruiken de voornaam van de contactpersoon als aanhef, met de bedrijfsnaam als terugval.

In het facturenoverzicht en op de factuurdetailpagina is de bedrijfsnaam eveneens de primaire klantnaam. De persoonsnaam staat daar aanvullend als **Contactpersoon**, zodat schermen en PDF steeds dezelfde klantidentiteit tonen.

Dezelfde aanmaakdialoog wordt gebruikt wanneer een onbekende vergaderdeelnemer als contact wordt toegevoegd.

## Persoonstypen

Het ACF-selectveld `person_type` kent drie waarden:

| Waarde | Betekenis |
| --- | --- |
| `member` | Lid of ouder/verzorger |
| `contact` | Extern verenigingscontact |
| `sponsor` | Businessclublid of sponsor |

Het aanvullende tekstveld `company_name` bewaart de bedrijfsnaam. De bedrijfsnaam is ook opgenomen in de CSV-export van de personenlijst en kan op de persoonspagina worden bijgewerkt.

Bestaande personen zonder opgeslagen `person_type` worden als lid/ouder behandeld. Daardoor is geen datamigratie nodig en blijven door Sportlink gesynchroniseerde personen compatibel.

Bevoegde gebruikers kunnen het persoonstype op de persoonspagina wijzigen. Contacten en sponsors krijgen daar en in de personenlijst een herkenbaar label.

De kolom **Type** op de personenlijst vat het record samen als **Bondslid**, **Verenigingslid**, **Ouder**, **Contact** of **Sponsor**. Het expliciete persoonstype heeft voorrang, zodat handmatig beheerde records ook bij vervuilde historische Sportlink-velden correct zichtbaar blijven.

## Filteren via REST

`GET /wp-json/rondo/v1/people/filtered` accepteert `person_type=member`, `person_type=contact` of `person_type=sponsor`.

- `contact` retourneert uitsluitend records met de expliciete waarde `contact`.
- `sponsor` retourneert uitsluitend records met de expliciete waarde `sponsor`.
- `member` retourneert records met `member` én bestaande records zonder waarde.

De frontend gebruikt dit endpoint voor het filter **Persoonstype** op de relatieslijst.

## Sponsorbeheer

Gebruikers met de ingebouwde rol **Rondo Sponsorbeheerder** kunnen via **Sponsor toevoegen** businessclubleden en sponsoren aanmaken. De pasvariant **Businessclub AWC** of **AWC Sponsor** is daarbij verplicht; dit wordt zowel in het formulier als door de REST API afgedwongen. Ze kunnen uitsluitend sponsorrecords aanpassen en verwijderen; de server weigert pogingen om leden of gewone contacten te muteren en voorkomt dat een sponsor naar een ander persoonstype wordt omgezet.

Een sponsor met gekozen pasvariant krijgt automatisch een publieke toegangspas-URL. Beide varianten gebruiken een witte achtergrond en tonen **Sponsor** als type. **Businessclub AWC** gebruikt het Businessclub-logo en de gelijknamige titel; **AWC Sponsor** gebruikt het gewone AWC-logo en de titel **AWC Sponsor**. De pasvariant kan later op de persoonspagina worden gewijzigd. Zie [Membership Passes](./membership-passes.md) voor de technische pasopbouw.

## Relaties

Contacten gebruiken het bestaande bidirectionele relatiesysteem. De Relaties-kaart is voor bevoegde gebruikers ook zichtbaar als er nog geen relatie bestaat, zodat de eerste relatie vanaf het nieuwe contact kan worden aangemaakt.
