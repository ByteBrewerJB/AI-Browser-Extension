<div align="center">

<img src="assets/icons/icon-128.png" alt="Project Logo" width="128">

# AI ChatGPT Companion Extensie

**Een browserextensie om je ChatGPT-ervaring te verbeteren met live statistieken, chat-organisatie en meer.**

[![Licentie](https://img.shields.io/github/license/jouw-gebruikersnaam/jouw-repo?style=for-the-badge)](LICENSE.md)
[![Versie](https://img.shields.io/npm/v/jouw-pakket?style=for-the-badge)](https://www.npmjs.com/package/jouw-pakket)
[![Build Status](https://img.shields.io/github/actions/workflow/status/jouw-gebruikersnaam/jouw-repo/jouw-workflow.yml?style=for-the-badge)](https://github.com/jouw-gebruikersnaam/jouw-repo/actions)
[![Pull Requests](https://img.shields.io/github/issues-pr/jouw-gebruikersnaam/jouw-repo?style=for-the-badge)](https://github.com/jouw-gebruikersnaam/jouw-repo/pulls)

</div>

Een Chrome / Edge extensie die je ChatGPT-gesprekken vastlegt, live woord- en tekentellingen bijhoudt, en een meertalige popup/opties UI biedt voor het organiseren van chats, custom GPT's en prompt templates. Het primaire startpunt is een bubbel-dock rechts in het ChatGPT-venster die slimme overlays opent voor prompts, bladwijzers en dashboardacties. Audio-tooling en diepere productiviteitsworkflows staan gepland voor komende mijlpalen.

---

## 🖼️ Schermafbeeldingen

<div align="center">
  <img src="assets/placeholder-screenshot-1.png" alt="Screenshot 1: Feature A in actie" width="48%">
  <img src="assets/placeholder-screenshot-2.png" alt="Screenshot 2: Dashboard overzicht" width="48%">
</div>
*<p align="center">Hier kunnen beschrijvingen van de schermafbeeldingen komen.</p>*

---

## ✨ Kenmerken

- **📝 Live Statistieken:** Houdt automatisch woord- en tekentellingen bij terwijl je typt in ChatGPT.
- **🗂️ Organiseer Alles:** Beheer je gesprekken, custom GPT's en prompt templates moeiteloos via een overzichtelijk dashboard.
- **🚀 Snelle Toegang:** Een handige bubbel-dock opent slimme overlays voor je prompts, bladwijzers en belangrijkste acties, direct in het ChatGPT-venster.
- **🌐 Meertalige Interface:** De popup en opties-pagina zijn beschikbaar in meerdere talen.
- **💾 Automatisch Opslaan:** Legt je waardevolle ChatGPT-gesprekken veilig vast voor later gebruik.
- **💡 Toekomstgericht:** Gebouwd met oog op de toekomst, met geplande features zoals audio-tooling en geavanceerde productiviteitsworkflows.

## Inhoudsopgave

- [📋 Vereisten](#-vereisten)
- [🚀 Installatie](#-installatie)
- [🛠️ Ontwikkeling](#️-ontwikkeling)
- [📚 Documentatie & Planning](#-documentatie--planning)
- [📦 Build](#-build)
- [✅ Lint & Type Check](#-lint--type-check)
- [🧪 Tests](#-tests)
- [📂 Projectstructuur](#-projectstructuur)
- [💡 Ideeën voor testen](#-ideeën-voor-testen)
- [➡️ Volgende Stappen](#️-volgende-stappen)

## 📋 Vereisten
- Node.js 20.19 of nieuwer
- npm 9+

## 🚀 Installatie
```bash
npm install
```

## 🛠️ Ontwikkeling
Start Vite in watch-modus en laad de uitgepakte extensie in je browser (richt zich op https://chat.openai.com en https://chatgpt.com):
```bash
npm run dev
```
1. Open in Chrome/Edge `chrome://extensions` of `edge://extensions`.
2. Schakel **Developer mode** in.
3. Kies **Load unpacked** en selecteer de `dist` map zodra Vite de eerste build heeft voltooid.
4. Houd de dev-server actief voor hot-reload van de popup/opties. Herlaad de extensiepagina na wijzigingen in het manifest.

### Bekende waarschuwingen in de dev-console

Terwijl de dev-server draait, kan Chrome meldingen loggen zoals `Service worker registration failed. Status code: 3` en `Access to script at 'http://localhost:5173/@vite/client' has been blocked by CORS policy`. Deze zijn afkomstig van de CRXJS dev-loader die de background worker opstart en zijn onschadelijk—ze verdwijnen in productiebuilds (`npm run build`). Als je ze ziet, controleer dan of de Vite dev-server nog draait en herlaad de extensie na de eerste succesvolle compilatie.

## 📚 Documentatie & Planning

- `retrofit.md` – Leidend retrofitplan met status per featuregroep en logboek voor voortgang (bijwerken na elke feature-drop).
- `docs/roadmap.md` – High-level architectuursnapshot en faseplanning; houd de statuskolom synchroon met het retrofitplan.
- `docs/testing/manual-regression.md` – Regressiescript voor popup, dashboard, content-script en storage flows; noteer resultaten in het logboek van `retrofit.md`.
- `docs/decisions/` – Architectuur- en productbesluiten (ADR-formaat). Leg belangrijke keuzes hier vast.
- `docs/testing/` – Aanvullende QA-scripts of testhulpjes.

## 📦 Build
Produceer een productiebuild in de `dist/` map:
```bash
npm run build
```
Je kunt de map handmatig zippen of dit later automatiseren voor indiening bij de store.

## ✅ Lint & Type Check
```bash
npm run lint
```
Dit commando voert TypeScript uit in `--noEmit` modus. Voeg ESLint/Prettier toe als je aanvullende linting-regels nodig hebt.

## 🧪 Tests
```bash
npm run test
```
Voert de op Node-gebaseerde test-harness uit (prompt chain storage en de content-script ingestion suite). Het commando gebruikt de custom loader in `tests/ts-node-loader.mjs` om in-memory Chrome/IndexedDB mocks te bieden die nodig zijn voor de Vitest-stijl specificaties. Zorg ervoor dat `npm run lint` en `npm run build` ook slagen voordat je een PR of release voorbereidt.

### Handmatige regressietest
- Volg het [popup/dashboard/bookmark/counter regressiescript](docs/testing/manual-regression.md) op beide ChatGPT-domeinen voordat je UX-wijzigingen doorvoert. Log het resultaat, de gebruikte browser en de commit in het logboek van [`retrofit.md`](retrofit.md).

## 📂 Projectstructuur
- `docs/` – Documentatiehub (retrofitplan, roadmap, beslissingen, QA).
- `src/background` – Service worker voor contextmenu's en bericht-stubs (bladwijzer/audio-acties).
- `src/content` – DOM-integraties op chat.openai.com/chatgpt.com voor het vastleggen van gesprekken en live statistieken.
- `src/core` – Dexie-opslag, modellen en sync bridge helpers die worden gedeeld tussen verschillende onderdelen.
- `src/options` – Dashboard voor gesprekken, mappen, custom GPT's en beheer van prompt templates.
- `src/popup` – Snelle-toegang UI voor recente gesprekken met pin/bladwijzer-toggles, taal/richting-controles en placeholders voor toekomstige features.
- `src/shared` – Lokalisatie, Zustand-stores en gedeelde hooks.
- `assets/icons` – Placeholder-iconen voor de extensie.

## 💡 Ideeën voor testen
- Breid `npm run lint` uit met ESLint zodra de bedrijfslogica is gestabiliseerd.
- Voeg unit tests toe voor opslag/zoek-services wanneer deze worden geïmplementeerd (bijv. Vitest + React Testing Library).
- Breid het handmatige regressiescript uit met extra dashboardfilters of audioscenario's zodra deze worden toegevoegd.

## ➡️ Volgende Stappen
Zie `retrofit.md` voor het actuele retrofitwerk en `docs/roadmap.md` voor de architectuursnapshot en premium-planning.