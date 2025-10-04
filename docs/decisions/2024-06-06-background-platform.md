# ADR 2024-06-06: Background platform voor auth, geplande exports en messaging

## Context

De extensie krijgt meerdere achtergrondtaken die verder gaan dan de huidige contextmenu-acties:

- **JWT/JWKS authenticatie** voor het valideren van sessies met de Companion backend.
- **Geplande exports** die gesprekken periodiek als dataset/backup wegschrijven.
- **Premiumcontrole** zodat gated features enkel voor betalende gebruikers worden geactiveerd.
- **Messaging hub** die content-, popup- en options-surfaces type-safe met elkaar laat praten.

De bestaande background worker bestond uit één bestand met inline listeners zonder duidelijke scheiding van verantwoordelijkheden of persistente job-afhandeling.

## Decision

We introduceren een modulair achtergrondplatform:

1. **Modules**
   - `background/auth.ts` beheert JWT-acceptatie en JWKS-caching en levert statussen door.
   - `background/jobs/` bevat een jobqueue (Dexie fallback naar memory) en een scheduler die Chrome alarms en interval-fallbacks benut.
   - `background/messaging.ts` host een type-safe router die runtime/tab berichten valideert en de juiste module aanspreekt.
2. **Jobqueue**
   - Jobs worden als records in Dexie opgeslagen (`jobs`-tabel, status + planmoment) met retry-metadata.
   - Scheduler verwerkt due jobs en re-scheduled ze via alarms/interval.
3. **Messaging contracten**
   - Een gedeelde contractdefinitie (`shared/messaging/contracts.ts`) beschrijft request/response paren voor surfaces.
   - Helpers voor runtime en tab-berichten garanderen compile-time validatie.
4. **Integraties**
   - Content/popup/options gebruiken de routerhelpers zodat achtergrondwijzigingen type-safe blijven.
   - Scheduler exposeert een API waarmee messaging-handlers exportjobs kunnen plannen.

## Consequences

- Auth, jobs en messaging kunnen onafhankelijk getest/vervangen worden.
- Nieuwe achtergrondfeatures (premium-checks, exports) krijgen een natuurlijke plek in de jobqueue + router.
- Surface code krijgt directe feedback van TypeScript wanneer contracten wijzigen.
- Er is extra complexiteit (Dexie schema + scheduler), maar dit is nodig voor de toekomstige roadmap.
