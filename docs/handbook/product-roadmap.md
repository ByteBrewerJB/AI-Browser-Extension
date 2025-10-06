# AI Browser Extension — Architecture & Delivery Roadmap

_Last updated: 2025-10-05_

This living document combines the architectural snapshot, delivery status, and premium launch planning for the AI Browser Extension. Update it whenever shipped functionality or priorities change so contributors have a single source of truth.

> Houd [`docs/handbook/retrofit-tracker.md`](./retrofit-tracker.md) naast dit document open tijdens planning-sessies: het retrofitlog vat de concrete implementatiestappen per featuregroep samen, terwijl deze roadmap de lange-termijnfasering en afhankelijkheden bewaakt.

## Koppeling met retrofitlog
- **Statusbron** – Gebruik de tabel in het retrofitlog om snel te zien welke featuregroepen “gereed”, “in ontwikkeling” of “in ontwerp” zijn. Werk bij het afronden van een feature zowel daar als in de faserings-tabellen hieronder.
- **Scopecontrole** – Wanneer een item in dit roadmapdocument een concrete deelstap krijgt, voeg de technische acties toe aan het retrofitlog zodat de checklist actueel blijft.
- **Logboek** – Noteer afgeronde deliverables met datum/commit in het retrofitlog en verwijs vanuit release notes naar dezelfde entries voor traceerbaarheid.

## Current implementation snapshot

### Surfaces
- **Content script** – Legt gesprekken vast, bewaakt live woord- en tekenaantallen, renderert de rechter dock en synchroniseert acties (bookmark, prompt, pin) via Dexie.
- **Popup** – Toont recente gesprekken, bladwijzers, pinned lijsten, taal/RTL instellingen en een Guides-kaart met telemetrie logging.
- **Options / dashboard** – Bundelt geplande exports, gidsen, gesprekshistorie (met filters, presets en bulkacties), prompts/GPT-beheer en het media/audio proeflokaal.
- **Background service worker** – Beheert auth-status, jobqueue met backoff, downloadexports en eventlogging. Messaging routes verbinden popup, options en content.

### State & shared services
- **Dexie data model** – IndexedDB bevat gesprekken, berichten, prompts, GPT’s, folders, folder-items, bookmarks, instellingen, jobs en metadata. De nieuwe `folder_items` pivot houdt folderlidmaatschappen van gesprekken/prompts/GPT’s bij zodat bulkacties en hiërarchische zoekindexen de juiste relatie hebben. Het schema laat ruimte voor toekomstige sync/back-up tabellen.
- **Zoekservice** – MiniSearch-index wordt naar IndexedDB weggeschreven en bij opstart hersteld; documenten bevatten nu titels, tag-tokens en volledige mappaden. Verwijderingen houden conversatie- en berichtdocumenten in sync en een 10k-berichtencoldbuild klokt ~1,5 s met zoeklatency rond 3 ms.
- **Export pipeline** – TXT/JSON exports gebruiken client-side helpers; de background handler maakt bestanden aan en start automatisch een `chrome.downloads.download` zodra de job slaagt.
- **Authenticatie** – `AuthManager` decodeert JWT’s lokaal, deriveert premiumstatus en ondersteunt optionele JWKS caching. Signatuurvalidatie en refreshflows zijn nog niet geïmplementeerd.

## Delivery phases

| Phase | Theme | Status | Notes |
| --- | --- | --- | --- |
| 0 | MV3 foundation | ✅ Delivered | Manifest, Vite/CRX build, shared Tailwind tokens, lint/build automation. |
| 1 | Conversation capture | ✅ Delivered | DOM scanner, Dexie schema, live counters. |
| 2 | Workspace management | ✅ Delivered | Popup cards, dashboard filters, folders, prompt/GPT CRUD, i18n/RTL. |
| 3 | Productivity automation | 🚧 In progress | Job queue + export handlers live; search durability en extra UI polish volgen. |
| 4 | Audio tooling | 💤 Planned | Geen echte audio-opname of playback pipelines; media-instellingen zijn placeholders. |
| 5 | Sync & collaboration | 💤 Planned | Encryptie, cross-device merge en gedeelde workspaces ontbreken. |
| 6 | Intelligence & insights | 💤 Planned | Geen automatische analyses of aanbevelingen buiten huidige datacaptatie. |
| 7 | Platform extensibility | 💤 Planned | Side-panel integraties en externe API hooks nog niet gespecificeerd. |
| 8 | Quality & growth | 💤 Planned | Telemetry storage, observability en lokalisatie scorecards moeten nog worden opgezet. |

### Near-term backlog (Phase 3 focus)
_De onderstaande punten staan ook in het retrofitlog; markeer in beide bestanden wanneer scopes verschuiven._
- **Search & sidebar** – _Status: in uitvoering._ Dexie-schema uitgebreid met `folder_items` pivot en Minisearch verrijkt met tags/mappaden (10k benchmark gereed); zijbalk-wireframes en promptlauncher UX-spec zijn afgerond. De chain DSL-parser prototype (placeholders + `[[step.output]]`) staat klaar in `src/core/chains/chainDslParser.ts`. Volgende focus: accessibility review + Zustand-state implementatie voor pin/hide flows en het koppelen van de parser aan de launcherconfirmatie.
- Automatische jobs dashboard vervolledigen: retry hand-offs zichtbaar maken in de UI (filterpaneel live per 2025-10-05).
- MiniSearch-indexering naar een dedicated worker verplaatsen zodat grote datasets de content thread niet blokkeren.
- Promptketen-runner voorzien van progress feedback en annuleringsevents naar de popup.
- Contextmenu focusbeheer verbeteren (focus trap + refocus van het origineel) en documenteren in de accessibility playbook.

### Toekomstige thema’s (Phases 4–8)
Documenteer outstanding design/ADR links voordat ontwikkeling start. Maak nieuwe ADR’s alleen aan wanneer implementatie committers klaarstaan, zodat contributors scope kunnen traceren zonder te gissen.

## Premium addendum
De extensie draait vandaag volledig client-side. Premium readiness vereist expliciete backend-werkzaamheden:
- **Identity & entitlement** – Backend APIs die JWT’s uitgeven en valideren, JWKS handhaven en entitlement mutaties persistenter maken. De huidige client kan vervalste tokens niet detecteren.
- **Billing** – Integratie met het gekozen betaalplatform, webhookverwerking en retry/refund flows.
- **Telemetry & compliance** – Privacy-review, audit logging en veilige opslag voor premium-acties voordat gated features live gaan.

Documenteer voortgang hier in plaats van een aparte premium roadmap. Link naar backend-repo’s of ADR’s zodra services landen.

## Maintenance checklist
- Update dit bestand na elke release train of scopeswitch en synchroniseer de status met [`docs/handbook/retrofit-tracker.md`](./retrofit-tracker.md).
- Houd ADR’s in `docs/handbook/adr-*.md` in lijn met architectuurwijzigingen.
- Pas de regressiegids aan zodra UI- of storagegedrag wijzigt en verwijder verouderde copy uit surfaces die productie hebben gehaald.
