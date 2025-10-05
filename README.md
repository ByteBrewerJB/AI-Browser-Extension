<div align="center">
  <img src="assets/icons/icon-128.png" alt="AI Companion logo" width="128" />
  <h1>AI ChatGPT Companion</h1>
  <p><strong>Een browserextensie die ChatGPT uitbreidt met live statistieken, snelle acties en een productiedashboard.</strong></p>
</div>

## ✨ Hoogtepunten
- **Live gespreksoverzicht** – De content script registreert automatisch gesprekken, toont woord/tekencounters in de composer en biedt een rechterdock met geschiedenis-, actie-, prompt- en gidsbubbels.
- **Popup voor snelle acties** – Bekijk recente gesprekken, bladwijzers en pinned chats, wissel direct tussen EN/NL en LTR/RTL, en open het dashboard of gidsen met één klik.
- **Dashboard met jobbeheer** – Plan exports via de background jobqueue, beheer folders/presets, bouw promptketens en probeer de media-/audio-instellingen in een sandboxomgeving.
- **Custom contextmenu** – Shift+F10 op een bericht opent een menu met bookmark, prompt, kopieer en pin-acties inclusief toegankelijkheidslabels en toastfeedback.
- **Gedeelde opslag en messaging** – Dexie bewaart gesprekken, prompts, GPT’s en jobs; de background worker verzorgt authstatus, exports en telemetry via type-safe runtime-berichten.

## 📦 Installatie
```bash
npm install
npm run dev
```
1. Open `chrome://extensions` of `edge://extensions`.
2. Schakel **Developer mode** in en kies **Load unpacked**.
3. Selecteer de `dist` map zodra de Vite dev-server de eerste build heeft voltooid.
4. Herlaad de extensie na wijzigingen aan manifest of background code.

## 🧪 Quality & testen
- `npm run lint` – TypeScript strict linting.
- `npm run build` – Productiebundel.
- `npm run test` – Node-gebaseerde testsuite (met Chrome/IndexedDB mocks).
- Handmatige regressies: volg [`docs/handbook/manual-regression-checklist.md`](docs/handbook/manual-regression-checklist.md) op beide ChatGPT-domeinen en log runs in [`docs/handbook/retrofit-tracker.md`](docs/handbook/retrofit-tracker.md).

## 🗺️ Documentatie
- [Product roadmap](docs/handbook/product-roadmap.md) – Architectuursnapshot en faseplanning.
- [Retrofit tracker](docs/handbook/retrofit-tracker.md) – Status per featuregroep en logboek.
- [ADR’s](docs/handbook) – Auth-, background- en toegankelijkheidsbesluiten (`adr-*.md`, `accessibility-context-menu.md`).

## 🧭 Projectstructuur
```
assets/                Statics zoals icons
public/guides.json     Gidsdataset voor popup/options/content
src/background/        Service worker (auth, jobs, messaging, contextmenu)
src/content/           DOM-integratie, dock, promptlauncher, contextmenu overlay
src/options/           Dashboard (history, prompts, media, guides)
src/popup/             Popup UI met taal/RTL instellingen en activity feed
src/shared/            Zustand stores, hooks, i18n, messaging helpers
src/core/              Dexie storage, modellen, export helpers
tests/                 Node/Vitest suites + E2E plannen
```

## 🤝 Bijdragen
Lees [CONTRIBUTING.md](CONTRIBUTING.md) voor workflow, QA en documentatieverwachtingen. Gebruik conventionele commits en werk relevante handbook-bestanden bij wanneer gedrag wijzigt.
