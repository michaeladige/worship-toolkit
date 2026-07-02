# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WorshipToolkit is a client-only Angular SPA (no backend) that lets worship teams
upload a SongSelect PDF chord chart, parse it into an editable model, transpose /
annotate it, and export clean PDFs or Markdown. All state lives in the browser
(`localStorage`) — there is no server, database, or API layer anywhere in this repo.

## Commands

```bash
npm install              # install deps
ng serve                 # dev server at http://localhost:4200
ng build                 # production build (output: dist/worship-toolkit/browser)
ng test                  # runs vitest — NOTE: no *.spec.ts files exist in src/ yet
npm run deploy           # manual gh-pages deploy (normally CI does this instead)
```

There is no lint script configured (`prettier` is a dev dependency but not wired into
an npm script — run `npx prettier --write .` directly if needed).

Two standalone Node scripts at the repo root are debugging aids, not part of the
build or test pipeline:
- `debug-pdf.mjs <file.pdf>` — dumps raw pdfjs text items (x/y/width) for a PDF, useful
  when the parser mis-reads a new chart layout.
- `test-parser.mjs` — a quick smoke test of the chord regex (`CHORD_RE`) against known
  chord/lyric examples; run with `node test-parser.mjs` after touching chord-matching logic.

## Deployment

Pushing to `main` and pushing to any other branch trigger **different** GitHub Actions
workflows (`.github/workflows/deploy.yml` / `deploy-beta.yml`):
- `main` → builds with `--base-href /worship-toolkit/` → deploys to the gh-pages root
  (production: `https://michaeladige.github.io/worship-toolkit/`)
- any other branch → builds with `--base-href /worship-toolkit/beta/` → deploys to
  `gh-pages/beta` (`.../worship-toolkit/beta/`)

Both workflows push straight to `gh-pages` on every push — there's no build gate/PR
check before deploy, so broken builds on `main` go live immediately.

## Architecture

### Data flow

`ParsedSong` (`src/app/models/song.model.ts`) is the single source of truth for a song:
title/key/tempo/time signature plus `SongSection[]` → `SongLine[]` → `ChordToken[]`
(chord text + `xPercent` horizontal position + optional `charPos`/`annotation`). Nearly
every component and service reads or transforms this shape; when adding a feature, extend
`ParsedSong`/`SongSection`/`SongLine` rather than inventing a parallel structure.

`WorkspaceComponent` (`components/workspace/`) is the app's root state owner: it holds
`songs: ParsedSong[]` + `selectedIndex`, and every mutation from child components
(song list reorder/add/remove, editor edits) flows back up through `onSongsChange` /
`setSongs()`, which:
1. pushes the previous state onto an in-memory undo stack (Ctrl+Z/Ctrl+Shift+Z /
   Ctrl+Y handled via a `HostListener`, capped at `HISTORY_LIMIT = 50`),
2. writes the whole song array to `localStorage` (`worship_toolkit_session`), and
3. calls `SessionsService.autosave()` to persist into whichever named "saved set" is
   currently active.

### Services (all `providedIn: 'root'`, in `src/app/services/`)

- **`PdfParserService`** — the most complex piece. Parses SongSelect PDFs via
  `pdfjs-dist`, reconstructing lines/columns from raw text item x/y coordinates
  (two-column layouts, superscript chord extensions like `Fm⁷`, direction/bar-notation
  annotations). Loads the pdf.js worker as a same-origin Blob URL rather than
  `importScripts()`-ing the CDN/asset URL directly — Blob workers have a null origin on
  iOS Safari, so a true cross-origin worker fetch silently fails there. Don't "simplify"
  that fetch-then-Blob pattern without checking iOS Safari behavior.
- **`ChordService`** — pure chord-string logic: `isChord`/`isChordLine` detection via
  `CHORD_RE`, transposition (`transposeChord`/`transposeKey`), Nashville Number System
  conversion, and sharps-vs-flats spelling (`Accidentals: 'auto' | 'sharps' | 'flats'`).
  This is the only place that understands chord grammar — route new chord-text
  manipulation through here instead of re-deriving regexes elsewhere.
- **`ExportService`** — renders a `ParsedSong[]` to PDF (via `jsPDF`, monospace layout so
  chords stay aligned over lyrics) or Markdown. Fonts (JetBrains Mono) are fetched once,
  base64-encoded, and cached in-memory (`jetbrainsMonoPromise`) since exporting is a
  frequent action and refetching ~800KB of font data per export would be wasteful.
- **`SessionsService`** — manages named "saved sets" (up to 20, in `localStorage`),
  autosave-to-active-set, import/export of `.wt` (JSON) files, and exposes
  `sessionLoad$` (an RxJS `Subject`) that `WorkspaceComponent` subscribes to for
  swapping the whole workspace when a set is loaded.
- **`UiSettingsService`** — large (~1800 lines) because it also holds the full
  translation table (see i18n below) plus theme/font/text-size/accidentals preferences,
  all persisted under a single `worship_toolkit_prefs` `localStorage` key with
  legacy-key migration for pre-consolidation storage formats.

### Components (`src/app/components/`)

Standalone Angular components (no NgModules anywhere in the app), one directory each:
`workspace` (root/orchestrator), `upload`, `song-list`, `song-editor`, `song-section`
(chord/lyric line editing — drag-to-reposition chords, add/remove lines), `export-modal`,
`sessions-modal`, `settings-modal`, `manual` (in-app user manual). Routing
(`app.routes.ts`) only has two real routes: `/` (workspace) and `/manual`; everything
else about "screens" (upload vs. editor vs. modals) is conditional rendering inside
`WorkspaceComponent`, not separate routes.

### Internationalization

Five UI languages (`en`, `la` Latin, `zh-TW`, `id` Indonesian, `jv` Javanese) are
implemented as a flat string-lookup dictionary (`TRANSLATIONS` in
`ui-settings.service.ts`), keyed by the literal English source string — there is no
i18n framework/extraction step. When adding user-facing strings, add an entry to
`TRANSLATIONS` (and a toast in `LANG_TOASTS` if it's a switchable mode) rather than
introducing a new translation mechanism. Language preference is stored per saved-set
and restored on load, separate from the global UI preference.

### Conventions

- Prettier: single quotes, 100-char print width (`.prettierrc`); `.html` templates use
  the `angular` parser.
- TypeScript strict mode is on (`strict`, `noImplicitOverride`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `strictTemplates`, `strictInjectionParameters`) —
  respect it rather than widening types to work around errors.
- Angular schematics are configured to skip generating spec files by default
  (`skipTests: true` in `angular.json`) and no component/service currently has tests,
  even though `vitest` is wired up as the test runner.
