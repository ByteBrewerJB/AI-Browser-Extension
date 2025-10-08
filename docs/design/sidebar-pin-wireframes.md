# Zijbalk pin/hide/collapse wireframes

_Laatste update: 2025-10-17_

Deze notitie beschrijft de wireframes voor de professionele zijbalk met pin-, hide- en collapse-flows. Ze fungeert als referentie voor componentbouwers en QA totdat definitieve visual assets zijn uitgewerkt.

## Scope
- Zijbalkcomponent voor ChatGPT-domeinen (`content/` injecties) en popup.
- Interacties rond GPT-secties, mappen en utilities (zoeken, filters).
- Niet gedekt: promptlauncher, theming, keyboardshortcuts buiten pin/hide.

## User journeys
1. **Pinned GPT-sectie**
   - **Start** – Gebruiker opent zijbalk; "GPTs"-sectie zichtbaar met lijst.
   - **Actie** – Klik op pin-icoon of gebruik `Shift+P` terwijl een GPT is gefocust.
   - **Resultaat** – GPT-sectie verhuist naar bovenste cluster "Pinned", krijgt highlight van 4 px linkeraccent.
   - **Feedback** – Toast "GPT vastgezet" (2 s) met undo-knop; undo herstelt vorige positie.
   - **Persist** – Zustand `sidebarPrefs.pins` slaat ID op; Dexie sync volgt roadmap voor gedeelde apparaten.

2. **Hide GPT-sectie**
   - **Start** – Gebruiker ziet lijst van GPT's; wil GPT verbergen.
   - **Actie** – Klik op overflow-menu → "Verberg".
   - **Resultaat** – Item verdwijnt uit lijst en verschijnt onder collapsible "Verborgen GPT's" onderaan.
   - **Feedback** – Banner "Verborgen GPT's verplaatsen zich hier" met link "Herstel".
   - **Persist** – Instelling `sidebarPrefs.hiddenIds` geüpdatet; weergave filtert items realtime.

3. **Collapse flows**
   - **Sectie collapse** – Chevron-knop rechts van sectieheader; collapse animatie ≤120 ms; status wordt opgeslagen in `sidebarPrefs.collapsedSections`.
   - **Sticky search** – Zoeken blijft zichtbaar; bij collapse blijft zoekresultaat preview badges tonen.
   - **Keyboard** – `[` en `]` navigeren tussen secties; `Enter` toggelt collapse.

4. **Bulk pin vanuit selectie**
   - **Bulk select** – Shift+Click selecteert range in GPT-lijst.
   - **Actie** – Toolbar verschijnt onder zoekveld met knoppen "Pin", "Verberg", "Verplaats".
   - **Resultaat** – Bulk pin plaatst selectie in "Pinned" in originele volgorde; toont telling in toast.

## Layout specificaties
- Breedte: 320 px standaard, 360 px in popup.
- Header h-12 met titel en close-knop.
- Sectieheaders: text-sm/medium, uppercase label + badge met telling.
- Items: h-10, icon links, titel, subtitel (laatste activiteit).
- Draggable area: volledig item behalve acties; drag handle 16 px rechts.

## Status indicatoren
- Pinned items: stericoon gevuld + accentborder.
- Hidden lijst: grijs (text-muted), toont teller en herstelknop per item.
- Collapsed secties: chevron wijst rechts; aria-expanded=false.

## QA-aanwijzingen
- Controleer dat Zustand-state synchroon blijft na reload (`sidebarPrefs`).
- UI-tests schrijven om toast + undo te verifiëren (`@testing-library/react`).
- Handmatige check: pin → reload → gepinde sectie blijft bovenaan; collapse status blijft behouden.
- Accessibility: toetsnav flows (`Tab`, `Shift+P`, `[`/`]`, `Enter`) documenteren en testen; verifieer dat collapse-knoppen "Collapse/Expand {section}" aankondigen en popup-toggles per sectie een unieke screenreadernaam hebben in EN/NL.
- Popup- en dashboardvoorkeuren (SidebarPreferences) moeten pin/hide/collapse direct weerspiegelen in de content-zijbalk; verifieer dat `data-ai-companion-pinned-count`/`hidden-count` attributen wisselen op het shadow-host element.

## Toegankelijkheidsaanpassingen (2025-10-17)
- Content-secties zijn als `role="region"` gemarkeerd en gekoppeld aan hun kop via `aria-labelledby`, zodat screenreaders context zien bij het navigeren tussen clusters.
- Collapse-knoppen gebruiken dynamische aria-labels (`Collapse/Expand {{section}}`) en houden `aria-expanded` synchroon met de zichtbaarheid van de lijst.
- Popupkaart **Sidebar layout** groepeert pin/hide/collapse-knoppen per sectie (`role="group"` + beschrijving) en voorziet elke knop van een unieke aria-label die de sectietitel bevat.
- Engels en Nederlands kregen gelijke vertalingen voor de nieuwe aria-labels zodat locale-switches dezelfde toegankelijkheidsdekking behouden.

## Zustand-voorkeuren (update 2025-10-16)
- `sidebarVisibilityStore` hydrateert popup, opties en content tegelijk; pin/hide/collapse worden via `chrome.storage.local` gedeeld.
- Popupkaart **Sidebar layout** geeft snelle toggles met knoppen voor vastzetten, inklappen en verbergen.
- Dashboardkaart **Zijbalkindeling** biedt een tabel met checkboxen voor dezelfde voorkeuren plus contextcopy per sectie.
- Het shadow-host markeert het aantal vastgezette/verborgen secties via data-attributen zodat thema’s en QA-scripts de status kunnen lezen.

## Volgende stappen
- Visuele assets (Figma) genereren en koppelen zodra ontwerpteam levert.
- Beslissen of verborgen secties na 30 dagen automatisch worden hersteld.
- Toetsen hoe het vastgezette cluster samenwerkt met mapweergave en bulkacties voor chats.
- Evalueren of undo/redo-toasts een wachtrij nodig hebben bij snelle acties en of automatische herstelmeldingen nuttig zijn voor langdurig verborgen secties.
