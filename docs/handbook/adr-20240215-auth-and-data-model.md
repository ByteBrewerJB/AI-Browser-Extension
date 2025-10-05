# ADR 2024-02-15 — Auth & data model richting premiumuitrol

_Last reviewed: 2025-02-15_

## Context
Premiumfeatures vragen om een betrouwbare identiteit, entitlementvalidatie en zorgvuldig databeheer. De huidige extensie draait volledig client-side maar moet voorbereid zijn op:
- Het onderscheiden van gratis versus betalende accounts voor gated UI.
- Het veilig opslaan van gespreks- en promptdata in Dexie zonder privacykaders te schenden.
- Het kunnen uitbreiden naar backend API’s zonder onze lokale flows te breken.

## Besluit
We hanteren een client-first aanpak met een lichte authlaag en een uitbreidbaar datamodel.

### Auth laag
- `AuthManager` decodeert JWT’s lokaal en gebruikt `plan`, `tier`, `roles` en `premium` claims om `premium: boolean` af te leiden. Expiraties (`exp`) zetten de tokenstatus automatisch op ongeldig.
- JWKS-support bestaat maar wordt enkel gebruikt om bekende key id’s te cachen (`hasKey`). Omdat signatures nog niet worden geverifieerd, beschouwen we het resultaat als heuristiek voor UI-weergave in plaats van harde beveiliging.
- Tokens leven uitsluitend in geheugen (service worker scope). Er is geen refresh flow of opslag op schijf; dit voorkomt dat verouderde tokens lekken maar vereist backendondersteuning zodra echte sessies worden opgezet.

### Data model
- Dexie (`src/core/storage/db.ts`) bevat tabellen voor gesprekken, berichten, prompts, GPT’s, folders, folder-items, bookmarks, instellingen en de jobqueue. `folder_items` fungeert als pivot tussen mappen en inhoud zodat bulkacties en hiërarchische zoekindexen meerdere itemtypes kunnen ondersteunen zonder duplicatie. De structuur blijft ontworpen zodat toekomstige sync/backups extra tabellen kunnen toevoegen zonder brekende migraties.
- Encryptiehelpers bestaan (`core/storage/service.ts`) maar zijn niet geactiveerd. Zolang we lokaal blijven draaien, volstaat dit; zodra server syncs live gaan moeten we payloads versleutelen voordat ze het apparaat verlaten.
- Entitlements worden momenteel niet opgeslagen. Premium UI gebruikt runtime auth-status; wanneer backendkoppeling komt, voegen we een `accounts`-tabel toe zodat entitlementwijzigingen offline kunnen worden afgedwongen.

## Consequenties
- UI kan premium-features al conditioneel tonen via `auth/status`, maar beveiliging berust op vertrouwen in de client. Een kwaadwillige gebruiker kan tokens fabriceren totdat server-side validatie wordt ingevoerd.
- Het datamodel is klaar voor uitbreidingen zoals `backups`, `syncQueue` of `announcements` zonder grootschalige refactors.
- Privacy blijft beheersbaar omdat gegevens het apparaat niet verlaten. Zodra exports/telemetrie backendcalls maken, zijn DPIA en loggingmaatregelen nodig.

## Follow-up acties
1. Implementeer signature-verificatie (`crypto.subtle`) zodra JWKS beschikbaar is en breid `AuthManager` uit met token-refresh en auditlogging.
2. Introduceer een `AccountRecord` in Dexie om entitlementstatus en premiumgrenzen offline te kunnen afdwingen.
3. Documenteer datastromen en retentiebeleid in een aparte privacy-notitie voordat server-syncs live gaan.
4. Bouw integratietests die auth-messaging, job scheduling en Dexie-migraties combineren zodat we regressies sneller detecteren.

Deze ADR blijft leidend totdat backend-integraties landen; update haar samen met nieuwe premium-features of gegevensstromen.
