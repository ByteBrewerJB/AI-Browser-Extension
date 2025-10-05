# Retrofit tracker

_Last reviewed: 2024-10-20_

Dit werkdocument houdt bij hoe de huidige extensie zich verhoudt tot de oorspronkelijke conceptmockups. Gebruik het tijdens planningssessies om delivered flows, lopende iteraties en resterende ontwerptaken scherp te houden. Synchroniseer wijzigingen met [`docs/handbook/product-roadmap.md`](./product-roadmap.md) en de regressiegids.

## Samenvatting featuregroepen
| Featuregroep | Scope | Status | Laatste update |
| --- | --- | --- | --- |
| Conversatiedock & bubbels | Shadow-root host, bubbledock rechts, sneltoetsen, history/actions/prompts/guides/media tabs | ✅ Gereed | 2024-10-20 – main branch |
| Pin- & bulkbeheer | Pinned weergaves, bulk selectie, verplaatsdialogen, favoriete mappen cache | ✅ Gereed | 2024-10-20 – main branch |
| Bladwijzers & contextmenu | Bubbelacties, inline notitiemodaal, custom contextmenu met toasts en popup-sync | ✅ Gereed | 2024-10-20 – main branch |
| Promptbibliotheek & ketens | GPT- en promptbeheer, keten-editor met variabelen, launcher integratie, cancel flow | ✅ Gereed | 2024-10-20 – main branch |
| Gespreksanalyse & export | MiniSearch index, export jobs (JSON/TXT), dashboard jobtable | 🚧 Iteratie | 2025-10-05 – status badges tonen retry/backoff |
| Media & audio | Instellingenscherm met toggles, preview overlay, modal skeletons | 💤 Placeholder | 2024-10-20 – functionaliteit simulatie, geen echte audio |
| Richting & instellingen | Taalwissel, RTL toggle, dock toggle synchronisatie | ✅ Gereed | 2024-10-20 – main branch |
| Guides & onboarding | Guides dataset, popup/options kaart, content modal, telemetry logging | ✅ Gereed | 2024-10-20 – main branch |
| Internationalisatie | EN/NL lokalisatie, RTL ondersteuning, settings-store sync | 🚧 Iteratie | 2024-10-20 – extra talen gepland |
| Account & premium | Auth-manager, premium vlag, entitlement storage, billing flows | 📝 Ontwerp | Nog te plannen |

> **Onderhoudstip** – noteer datum + commit (kort hash) in de kolom “Laatste update” zodra een featuregroep nieuw werk ontvangt. Voeg extra rijen toe wanneer een featuregroep wordt opgesplitst.

## Context & huidige stand
- Alle runtime oppervlakken zijn herschreven rond de rechter dock (`src/content/ui-root.tsx`). Links geplaatste panelen uit de oude mockups zijn uitgefaseerd.
- De promptlauncher (`src/content/textareaPrompts.ts`) en composer counters draaien naast elkaar binnen dezelfde shadow-root en delen stores met popup/options.
- Popup en dashboard gebruiken gedeelde hooks (`useRecentConversations`, `useGuideResources`, `useSettingsStore`) zodat statuswijzigingen realtime blijven.
- Background worker verzorgt contextmenu triggers, auth-status, exportjobs en eventlogging. Nieuwe jobtypes registreren zich via `createJobScheduler`.

## Werkafspraken
1. **Scope prioriteren** – Houd Phase 3-items (jobs/export/search) uit de roadmap als primaire focus. Nieuwe ideeën krijgen eerst een ADR of backlog entry voor ze in dit bestand landen.
2. **Documentatie spiegelen** – Werk bij:
   - [`docs/handbook/product-roadmap.md`](./product-roadmap.md) voor strategische fases.
   - [`docs/handbook/manual-regression-checklist.md`](./manual-regression-checklist.md) voor QA-stappen.
   - [`docs/handbook/adr-*.md`](./) voor architectuur- of privacybesluiten.
3. **Log voortgang** – Gebruik het logboek onderaan voor afgeronde tranches. Vermeld datum, commit, uitgevoerde checks (lint/test/build) en openstaande follow-ups.
4. **Featurepariteit bewaken** – Wanneer mockups van de `example/example/1` map afwijken van de implementatie, noteer het hier inclusief motivatie (bijv. technische beperking of UX-beslissing).

## Actieve iteraties & opvolgers
- **Export & jobs UI polish**
  - [x] Status-badges uitbreiden met retry count en volgende backoff tijd.
  - [x] Filterpaneel toevoegen aan het jobs-overzicht (status/type) – 2025-10-05.
  - [ ] Toast naar popup sturen wanneer een geplande export voltooid is.
- **Zoekindex worker**
  - [ ] MiniSearch-index rebuild verplaatsen naar een worker (`SharedWorker`/`ServiceWorker`) zodat grote datasets non-blocking zijn.
  - [ ] Progress events naar de dashboard history sectie sturen wanneer reindexing plaatsvindt.
- **Contextmenu focus management**
  - [ ] Actieve element bij openen bewaren en na sluiting herstellen.
  - [ ] Roving tabindex/arrow-key navigatie toevoegen voor toekomstige extra items.
- **Internationalisatie uitbreiding**
  - [ ] Automatische taalkeuze baseren op ChatGPT `lang`-attribuut met opt-out in instellingen.
  - [ ] Extra talen genereren (DE, ES, FR) via script en regressies opnemen in QA.

## Definition of done per featuregroep
Gebruik onderstaande checklists wanneer je aan de respectieve featuregroepen werkt.

### Dock & bubbels
- [ ] Alle bubbelknoppen keyboard- en screenreader-toegankelijk (labels + aria-pressed).
- [ ] Store synchronisatie (`useBubbleLauncherStore`) hydrateert via `chrome.storage` en zet default waarden zonder flikkering.
- [ ] Pattern modal en instructie-overlays resetten hun state na sluiting.

### Promptbibliotheek & ketens
- [ ] GPT/prompt CRUD slaagt en updates zijn zichtbaar zonder reload.
- [ ] Promptketen-runner ondersteunt annuleren en foutmeldingen met toasts.
- [ ] Variabelen in ketens zijn uniek en valideren met duidelijke foutcopy.

### Bladwijzers & contextmenu
- [ ] Bookmark modal toont preview, notitieveld en saved state.
- [ ] Contextmenu sluit bij scroll, Escape en dock-hide. Disabled states tonen helpercopy.
- [ ] Popup/Options synchroniseren bookmarks en laten meest recente bovenaan zien.

### Export & jobs
- [ ] Jobs schrijven naar Dexie, herstellen na worker herstart en tonen attempts/backoff in UI.
- [ ] Exports produceren geldige JSON/TXT bestanden en loggen fouten in de service-worker console.
- [ ] Dashboard jobs tabel ondersteunt sorteren/filteren zonder layout shift.

### Media workspace (placeholder)
- [ ] Instellingen toggles synchroniseren met `useMediaStore` en `chrome.storage.local`.
- [ ] Preview overlay sluit met Escape en herstelt focus naar de trigger.
- [ ] Modalcomponenten gebruiken gedeelde UI zodat toekomstige echte audio-implementaties drop-in zijn.

## Logboek
| Datum | Commit | Featuregroep(en) | Notities |
| --- | --- | --- | --- |
| 2024-10-20 | _pending_ | Documentatie | Mapstructuur geherorganiseerd naar `docs/handbook/`, roadmap/regressie/ADR’s geactualiseerd, contextmenu playbook bijgewerkt. |
| 2025-10-05 | _pending_ | Export & jobs UI | Status-badges tonen retry/backoff details; filterpaneel voor status/type toegevoegd aan dashboard; `npm run lint`, `npm run test`, `npm run build`. |

Voeg nieuwe regels toe met `YYYY-MM-DD | commit | scope | details` en noteer welke QA (lint/test/build/manual) is uitgevoerd.
