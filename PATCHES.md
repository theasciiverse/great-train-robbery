# Changes from upstream

This is the Asciiverse terminal edition of The Great Train Robbery, Ondřej
Žára's game for the 2026 Seven Day Roguelike Challenge, from
github.com/ondras/great-train-robbery (the `upstream` remote; this branch,
`asciiverse`, starts from its master at `e10b356`, 2026-03-06, with the
full history). It is MIT licensed, and here with the author's permission
as well (`PERMISSION.md`).

**The game's own files are unchanged.** The game runs from its bundled
`index.js` (its TypeScript compiled by `deno bundle`, as its Makefile makes
it). Everything new is in `asciiverse/`, plus this file and
`PERMISSION.md`; README.md gets a note at the top.

## How it works

The game is not built on rot.js but on today's browser: its town is drawn
by Ondřej's `<rl-display>` web component, the rest of the screen is HTML
styled as a text user interface, dialogs are `<dialog>` elements, and the
planning screens are tables and menus.

- `asciiverse/rotty/`: rotty, our runtime for Ondřej's games (as in
  Goldfish, The Royal Wedding and the others), with a new part, `web.js`,
  for this one: custom elements and shadow roots, `style.setProperty`,
  `<template>` content, `<dialog>`, text inputs you can type into, tables
  (`insertRow`, `insertCell`), `element.animate` (which waits out the
  duration), attribute selectors, `AbortController`, `URL` and
  `EventTarget`.
- `asciiverse/game.js`: the game's layout, after its CSS:
  - `<rl-display>`'s drawing calls (`draw`, `move`, `delete`, `fx`) keep a
    list of what is where; the map shows the topmost thing in each cell,
    the train in bold. The town is 63 by 39 cells: at 130x45 it shows
    whole; smaller, it follows the train during the heist, and the arrows
    scroll it (marks on the frame show where more of it is).
  - the menu bar and the title, the map or the current pane on the left,
    the log on the right with the latest at the bottom, the status at the
    bottom, the frame lines between them in the page's highlight colour,
    and dialogs centred in a double frame over the darkened screen.
  - a small renderer for the page's HTML: text wrapped into lines, keys
    (`<kbd>`) bold and underlined, `$` before gold, tables in columns with
    the chosen row marked `»` `«`, menus spread across their width.
- `asciiverse/build.py`, `asciiverse/Makefile`: the page's script, compiled
  with QuickJS-ng into one native binary of about 2 MB that needs nothing
  to run.

## Ours

- **Keys:** as in the browser, shown on screen. The arrows and Page
  Up/Down also scroll the town map when it is shown and does not fit.
  Ctrl+C or Ctrl+Q quits.
- **`--seed HEX`:** the town of that seed, as `?seed=` in the page's
  address gives it (the preview uses 1a2b3c).
- **Session log:** `great-train-robbery.log` in the state folder
  (`$XDG_STATE_HOME/great-train-robbery`, `~/.local/state/...`,
  Application Support on macOS, `%LOCALAPPDATA%` on Windows).
  `GREAT_TRAIN_ROBBERY_LOG=debug` (or `ROTTY_LOG=debug`) records every key
  and a snapshot each second.
- The page's font is not loaded, its animations (the map's moves and the
  newcomers' zoom) take their time but are not drawn in between, and
  "GitHub" on the game over dialog does nothing, with no browser to open.
- The screen is redrawn at most ten times a second while the townsfolk
  walk, to keep the processor quiet.

## Imported

- `asciiverse/quickjs/`: QuickJS-ng 0.17.0 as in our Candy Box 2 (one
  change in `quickjs-libc.c`: a signal interrupting `poll()` no longer ends
  the event loop), MIT.

## Packaging

- `.github/workflows/release.yml`: static Linux (musl, x86-64 and ARM64),
  macOS (x86-64 and ARM64) and Windows (x86-64, MinGW) archives plus
  SHA256SUMS, on tags `*-av.*`.
- `asciiverse/package.sh`: the archive (the program, LICENSE.md,
  CREDITS.md, PERMISSION.md, PATCHES.md, the licences of rotty and
  QuickJS-ng).
- `asciiverse/record-preview.sh`: the 100x30 catalog preview, with hub's
  castrec.py.
