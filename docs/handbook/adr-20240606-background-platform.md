# ADR 2024-06-06 — Background platform voor auth, geplande exports en messaging

_Last reviewed: 2024-10-20_

## Context
De oorspronkelijke background worker bestond uit één bestand dat enkel contextmenu-acties afhandelde. Naarmate features zoals jobplanning, gids-telemetrie en premiumdetectie zijn toegevoegd, was er behoefte aan een modulair platform dat:
- Authentisatie status bijhoudt (vooral premium-flags) zonder UI te blokkeren.
- Geplande exports kan herhalen en herproberen met backoff.
- Telemetrie vanuit popup/options/content accepteert zonder race conditions.
- Eén type-safe messaginglaag biedt voor alle surfaces.

## Besluit
We behouden een service-worker-gebaseerde architectuur maar knippen verantwoordelijkheden op in drie kernmodules:

1. **Authenticatie (`src/background/auth.ts`)**
   - `AuthManager` decodeert JWT’s lokaal, bepaalt premiumstatus (`plan`, `tier`, `roles`, `premium` claims) en exposeert `getStatus()` voor UI-surfaces.
   - JWKS-URLs zijn optioneel: `refreshKeys()` kan sleutels cachen zodat signature-verificatie later kan worden toegevoegd. De huidige implementatie gebruikt `hasKey(kid)` als feature-flag controle maar valideert tokens nog niet cryptografisch.
   - Tokens worden alleen in-memory opgeslagen; een refresh-flow of audittrail ontbreekt nog en moet in een vervolg-ADR worden uitgewerkt.

2. **Jobplatform (`src/background/jobs/`)**
   - `queue.ts` schrijft jobs naar Dexie (`db.jobs`) en valt terug op een in-memory map wanneer `indexedDB` ontbreekt, zodat Vitest en service-worker contexts hetzelfde pad delen.
   - `scheduler.ts` combineert een `setInterval`-loop met Chrome alarms. Bij het starten worden lopende jobs naar ‘pending’ teruggezet (`requeueRunningJobs`) en plannen we het eerstvolgende alarm. Faalgevallen krijgen exponentiële backoff (`backoffMultiplier` standaard 2×, `maxBackoffMs` standaard 8× interval) en bewaren de foutboodschap.
   - Standaard handlers:
     - `export` → `jobs/exportHandler.ts` exporteert geselecteerde gesprekken (TXT/JSON) en triggert vervolgens een `chrome.downloads.download` zonder UI.
     - `event` → `jobs/eventLogger.ts` logt gidsinteractie naar `console.info` inclusief metadata; deze stub houdt de API stabiel tot echte telemetry storage landt.

3. **Messaging (`src/background/messaging.ts`)**
   - Gebruikt `createRuntimeMessageRouter` zodat TypeScript contracten met surfaces delen (`RuntimeMessageMap`).
   - Routes bieden o.a. `auth/status`, `jobs/list`, `jobs/schedule-export`, `jobs/log-event` en `runtime/ping`.
   - Het `jobs/list` pad levert een `JobSnapshot` zonder payload zodat UI geen gevoelige gegevens krijgt en we response payloads consistent kunnen serialiseren.

Daarnaast wordt de contextmenu-setup (audio/download + bookmark triggers) in `background/index.ts` gehouden omdat dit manifest-permissies vereist maar geen onderdeel is van het jobplatform.

## Consequenties
- Auth-, job- en messaginglogica zijn onafhankelijk testbaar en uitbreidbaar. Nieuwe jobtypes hoeven enkel een handler te registreren.
- De UI kan exportstatussen, gids-telemetrie en auth-info opvragen via uniforme runtime-berichten, waardoor surfaces geen Chrome API’s direct hoeven te benaderen.
- Door Dexie als opslag te gebruiken, blijven jobs behouden bij een service-worker restart. De memory fallback houdt e2e-tests echter eenvoudig.
- Omdat JWT’s nog niet cryptografisch gevalideerd worden, vertrouwen we op payload-claims. Dit is acceptabel voor de client-side preview maar moet worden aangescherpt vóór publieke premium-lancering.

## Follow-up werk
- Signature-verificatie voor JWT’s integreren zodra de backend JWKS exposeert; voeg dan een auditlog voor tokenwissels toe.
- Een dedicated telemetry-store of batching-endpoint vervangen de huidige `console.info`-logger.
- Jobs die bestanden genereren (PDF/ZIP) vereisen een streaming API en progress events naar de UI. Voeg nieuwe message routes toe wanneer deze flows landschappen.
- Maak het alarm-interval configureerbaar via `ENV` zodat QA en productie andere cadans kunnen gebruiken.

Houd dit document synchroon met `docs/handbook/product-roadmap.md` en het retrofitlog wanneer nieuwe handlers, message-contracten of authopties bijkomen.
