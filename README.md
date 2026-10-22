# PoE 2 Price Checker

A Windows overlay: hover over an item in Path of Exile 2, press **Ctrl+E**, and a window with the price
appears on top of the game.

- **Currency and exchange items** (orbs, runes, essences, catalysts, etc.) are priced via poe.ninja:
  price per unit and per stack, 7-day change, trade volume.
- **Demand tab** — demand based on poe.ninja data: which builds use such an item, the most popular bases and mods
  for this item class; your item's base and mods are highlighted.
- **Gear, uniques, gems** are searched on the official trade site (`pathofexile.com/trade2`). The item's mods
  become filters; you can toggle them on and off and change minimums. Enter reruns the search.
  Clicking a listing copies a whisper to the seller.

## Download

**[⬇ Latest version — Releases](https://github.com/zhurauljou/poe2-advanced-price-check/releases/latest)** —
the file `PoE-2-Price-Checker-Setup-<version>.exe`. It is a regular Windows installer; Node.js is not required.
The installer is not signed, so Windows SmartScreen may warn about an unknown publisher:
"More info" → "Run anyway".

**Updates arrive on their own:** the program checks GitHub at startup and every 6 hours, downloads the new version
in the background and installs it on exit or via the "Restart to update" item in the tray.

The program lives in the tray. The icon menu has the league, **Settings…** (the settings window; it also opens on a double-click on the icon
or when the program is launched again), **Refresh game data** (after a game patch: fresh mods and bases right away) and update.

In the settings window:
- **Hotkey** — any combination with Ctrl or Alt (press the button and then the combination). The game sees the second key
  of the combination, so it must not do anything in the game: for example, D is a step to the right, and the chest closes;
- **Hotkey only in Path of Exile** — the hotkey works only in the game (default); other programs keep their own;
- **Start with Windows** — launch together with Windows;
- league, interface language and game client language;
- **Interface size** — window scale (80–150%), for 4K monitors;
- **Reset window position** — open the window at the cursor again, instead of where it was dragged.

The search toggles "Buyable now" and "Allow 1 minor mod missing" are remembered for the next items.

## Running from source

Requires Node.js 22+. Run `Start.bat` (on first launch it runs `npm install` itself) or `npm install && npm start`.
Build the installer: `npm run dist` (output goes to `dist/`). Tests: `npm test` — they also run in GitHub Actions on every push.
Craft tests run on a snapshot of game data (`test/fixtures/data`); after a patch: launch the program (it will refresh the cache),
check the scenarios on fresh data with `CRAFT_LIVE=1 npm test` and update the snapshot with `node scripts/snapshot-test-data.js`.
What changed in the game after a patch — `npm run check-patch` (GitHub also runs it once a week and opens an issue on changes).

Window screenshots (local): `npm run visual` captures 11 demo screens without network access and compares them with references pixel by pixel —
the differences go to `test/visual/out/*-diff.png`. The first time and after a patch — `npm run visual -- --record` (record network responses and
references); after an intentional change of the look — `npm run visual -- --update`. Recordings and references are not stored in git.

## Releasing a new version

1. Bump `version` in `package.json` and commit (there must be no uncommitted changes).
2. `npm run release -- "what's new"` — runs the tests, builds the installer, pushes the branch and the tag `v<version>`
   to this commit and publishes the release on GitHub (requires
   [GitHub CLI](https://cli.github.com/), logged in to an account: `gh auth login`).

Installed copies will see the release via `latest.yml` and update themselves.

**Important:** in the game settings choose the *Windowed Fullscreen* display mode.
In exclusive fullscreen mode Windows does not show windows on top of the game.

## Controls

| Key | Action |
|---|---|
| Ctrl+E | Price the item under the cursor (configurable in settings) |
| Esc | Close the overlay |
| Enter | Repeat the search with the current filters |

## Testing without the game

```
npx electron . --demo=path\to\item.txt --shot=out.png
```

Here `item.txt` is the item text copied from the game with Ctrl+C. With the `--shot` flag the program saves
a screenshot of the overlay and exits.

## Limitations

- Game client: English and Russian (detected automatically from the item text; can be chosen in settings).
  The program's interface language is chosen separately: English / "Русский".
- Russian client: mod lines are translated into English using the trade site's reference data, so crafting and demand work the same
  as with the English client. A line that is not in the reference data (flavour text, rare service lines) is left as is.
- Requests to the trade site are rate-limited by the GGG server (roughly 4 searches per 10 seconds). The program waits out the pauses itself.

## Data

Mod weight estimates (chances in the craft advice) are not game data: PoE 2 files have no modifier weights.
- `data/exalt-weights.json` — from rares exalted to 6 mods with plain Exalted Orbs and read whole (nobody picked them by
  their mods). Used for every class it has (100+ items).
- `data/weights.json` — from cheap trade listings, for the other classes (jewels). Sellers list items for the mods the market
  values, so such mods come out 2–4× too common there; their chance is not shown.

- Prices and demand — [poe.ninja](https://poe.ninja), mods and bases — [RePoE](https://repoe-fork.github.io/poe2), search — the official GGG trade site.
- Item names in other client languages and service lines — from [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (MIT).
