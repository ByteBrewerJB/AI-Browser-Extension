# Contextmenu toegankelijkheidsrichtlijnen

Deze notitie documenteert hoe het contextmenu in de content surface toegankelijk blijft terwijl we de retrofit uitvoeren.

## Interactiepatroon

- **Openen:** het menu wordt geopend via de standaard rechtermuisklik/`Shift+F10` op een ChatGPT-bericht. De listener in `CompanionSidebarRoot` onderschept het event en tekent het menu in de shadow-root.
- **Focusbeheer:** bij openen krijgt het menu automatisch focus doordat het een modale overlay vormt. Klikken buiten het menu of het scherm scrollen sluit het menu.
- **Sluiten:** `Escape` sluit het menu onmiddellijk. Daarnaast zorgt de unmount-cleanup ervoor dat het menu dichtgaat wanneer de sidebar wordt verborgen of het domein wisselt.

## Toetscombinaties en shortcuts

| Handeling | Toetsen | Opmerkingen |
| --- | --- | --- |
| Contextmenu tonen | Rechtermuisknop / `Shift+F10` | Werkt op berichten met `data-message-author-role`. |
| Dock toggelen | `Alt+Shift+K` | Handig om snel naar de bubbelpanelen te springen. |
| Menu sluiten | `Escape` | Beschikbaar zolang het menu zichtbaar is. |
| Dashboard openen | `Enter` op "Open dashboard" | Brengt gebruikers naar de history-view in de popup/options. |

## Labels en aankondigingen

- Elk menu-item heeft beschrijvende tekst (bijv. "Bookmark message", "Save as prompt").
- Wanneer een actie geen tekst kan verwerken, tonen we een tooltip (`title`) met uitleg dat de actie is uitgeschakeld.
- Toastmeldingen bevestigen succes- of foutstatussen; deze zijn zichtbaar en worden na drie seconden automatisch verwijderd.

## Testplan (Playwright)

De komende E2E-suite zal het scenario `tests/e2e/context-menu.spec.ts` gebruiken. Kernstappen:

1. Open ChatGPT, mount de extensie en forceer een berichtselectie.
2. Trigger het contextmenu via `page.keyboard.press('Shift+F10')` en verifieer dat het overlay-element zichtbaar is.
3. Activeer de bookmark-actie en controleer dat de bookmark-modal opent in dezelfde shadow-root.
4. Sluit het menu met `Escape` en verifieer dat het overlay-element verdwijnt.
5. Navigeer naar een andere ChatGPT-domain tab en bevestig dat er geen zwevend menu achterblijft (guard bij unmount).

Documenteer testuitkomsten in `docs/testing/manual-regression.md` wanneer de Playwright-run is opgezet.
