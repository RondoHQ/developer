---
title: "Externe contacten"
---

Rondo Club bewaart externe verenigingscontacten in hetzelfde WordPress `person`-posttype als leden en ouders. Daardoor kunnen contacten direct dezelfde adressen, onderlinge relaties, notities, taken en factuurkoppelingen gebruiken. Er is geen apart contactregister of aangepaste databasetabel.

## Contact toevoegen

Een gebruiker met rechten om personen te beheren kan op **Leden** de knop **Contact toevoegen** gebruiken. Het nieuwe record krijgt in ACF `person_type = contact`. Na het opslaan opent de persoonspagina, waar adressen en relaties kunnen worden toegevoegd.

Dezelfde aanmaakdialoog wordt gebruikt wanneer een onbekende vergaderdeelnemer als contact wordt toegevoegd.

## Persoonstypen

Het ACF-selectveld `person_type` kent twee waarden:

| Waarde | Betekenis |
| --- | --- |
| `member` | Lid of ouder/verzorger |
| `contact` | Extern verenigingscontact |

Bestaande personen zonder opgeslagen `person_type` worden als lid/ouder behandeld. Daardoor is geen datamigratie nodig en blijven door Sportlink gesynchroniseerde personen compatibel.

Bevoegde gebruikers kunnen het persoonstype op de persoonspagina wijzigen. Contacten krijgen daar en in de personenlijst een **Contact**-label.

## Filteren via REST

`GET /wp-json/rondo/v1/people/filtered` accepteert `person_type=member` of `person_type=contact`.

- `contact` retourneert uitsluitend records met de expliciete waarde `contact`.
- `member` retourneert records met `member` én bestaande records zonder waarde.

De frontend gebruikt dit endpoint voor het filter **Persoonstype** op de ledenlijst.

## Relaties

Contacten gebruiken het bestaande bidirectionele relatiesysteem. De Relaties-kaart is voor bevoegde gebruikers ook zichtbaar als er nog geen relatie bestaat, zodat de eerste relatie vanaf het nieuwe contact kan worden aangemaakt.

