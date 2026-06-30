# Changelog

All notable changes to WorshipToolkit are documented here. Versions follow `MAJOR.MINOR.PATCH`.

## [1.1.7] - 2026-06-30

### Fixed
- **PDF import fixed on iOS and Android** — uploading a PDF no longer freezes on the "Parsing PDF…" spinner. Two root causes were fixed: (1) downgraded PDF.js from v5 to v4.10.38 — v5's streaming text-extraction API hangs indefinitely inside iOS Safari web workers; v4 uses a one-shot extraction that works on all platforms. (2) The PDF.js worker is now loaded by fetching its script and inlining it in a self-contained Blob URL, removing a hidden cross-origin `importScripts()` call that silently failed on GitHub Pages and broke Android.
- **TURNAROUND recognized as a section** — the section-name parser now correctly identifies `TURNAROUND` (in addition to VERSE, CHORUS, BRIDGE, etc.) so it is parsed as a section header rather than lyric text.

## [1.1.6] - 2026-06-30

### Changed
- **Add-songs UI redesigned** — on desktop/tablet, `+ New Song` and `+ Import PDF` now appear directly as the last item in the song list (no "+" toggle needed). On mobile, a `+` toggle at the end of the horizontal tab strip expands a compact row below, same as before. In both cases the options sit immediately after the last song, not floating at the sidebar bottom.

## [1.1.5] - 2026-06-30

### Fixed
- **Mobile "Songs in Set" left padding** — text was flush against the left edge when the song bar was collapsed; restored correct horizontal padding.
- **Song list items now 2 rows on mobile** — each song tab shows `[≡] [title] [✕]` on the first row and the key badge on the second row, replacing the previous 3-row layout that wasted space.
- **Drag-to-reorder now works on mobile** — the `≡` drag handle is now visible in the song tab strip; touch-drag to reorder songs works the same way as on desktop.

## [1.1.4] - 2026-06-30

### Fixed
- **Mobile toggle consistent in both states** — "Songs in Set" label now appears in both expanded (`Songs in Set ▲`) and collapsed (`Songs in Set ▼`) states; previously only the collapsed state showed the label.
- **Mobile toggle spacing** — text and arrow now use consistent `gap`-based spacing in both states; the collapsed state no longer uses `justify-content: space-between` which pushed them to opposite ends.
- **"+" button moved to end of song list** — the add-songs toggle is now positioned below the last song (not in the sidebar header), making it intuitive to find. On mobile it appears at the end of the horizontal tab strip.
- **Append menu now opens directly below "+"** — `+ New Song` and `+ Import PDF` expand immediately below the `+` button in both PC sidebar and mobile tab bar views.
- **Append options slim and centered on mobile** — the `+ New Song` and `+ Import PDF` buttons in the expanded append row are slimmer and fully centered on mobile, so the tab bar does not grow excessively tall.

## [1.1.3] - 2026-06-30

### Added
- **"+" add-songs menu in sidebar** — a single `+` button in the sidebar header expands to reveal `+ New Song` and `+ Import PDF`. Keeps the song list uncluttered; rotates to × when open, and auto-closes when the sidebar collapses.
- **Current session info row in Sessions panel** — top of the modal now shows the active session name + last-modified time, or *"Unsaved session"* in italic when no session is tracked. Header button always reads "💾 Sessions" (no longer swaps to session name).
- **"Modified" timestamp on session list items** — each saved session now shows "Modified [date & time]" for at-a-glance recency.
- **Collapsible changelog entries in the manual** — version entries on the manual page expand/collapse on click; only the latest starts open.

### Changed
- **Removed "↺ New PDF" button** — replaced by Sessions modal `+ New`, which was already identical in function (clears workspace with optional save-first prompt). Eliminates the redundant button and its separate confirm flow.
- **Mobile toggle label** — the mobile song-bar toggle now says "Songs in Set" (when collapsed) to match PC/tablet; shows only the `▲` arrow when expanded to save space.
- **Sidebar button spacing** — added gap between the `+` and `◄` buttons in the sidebar header.

## [1.1.2] - 2026-06-30

### Added
- **Collapsible sidebar (desktop/tablet)** — click ◄ in the sidebar header to collapse it to a 32 px strip and give more room to the editor. Click ► to expand.
- **Collapsible song bar (mobile)** — tap "Song List ▲" in the mobile tab bar to collapse it and reclaim vertical screen space. Tap "Song List ▼" to expand.
- **Session-aware New PDF warning** — clicking ↺ New PDF now shows a context-sensitive confirmation: if a named session is active (already autosaved) it confirms simply; if there is unsaved work it offers to name and save it first.

### Fixed
- **"+ New" button incorrectly active on empty workspace** — the "+ New" button in the Sessions panel is now disabled when no songs are loaded, preventing a misleading "unsaved work" prompt from appearing on a blank canvas.

## [1.1.1] - 2026-06-30

### Added
- **Inline song title editing** — click the song title in the editor toolbar to rename it (Enter to save, Esc to cancel). Solves the "New Song" naming problem for blank songs.
- **Remove songs from the list** — a ✕ button appears on hover for each song in the sidebar. Removing the last song returns to the upload screen.
- **Load session file from the upload page** — "📂 Load session file" button on the landing page lets users open a `.wt` file directly without navigating to the Sessions panel first.
- **Autosave to active session** — once a session is named/loaded, every edit (chord, lyric, section, reorder) auto-saves to it silently. The Sessions button in the header shows the active session name (e.g. "💾 Sunday Service"). Active session is remembered across page reloads.
- **Active session indicator** — active session highlighted with a badge in the Sessions panel.
- **New Session button** — "+ New" in the Sessions panel header clears the workspace. If current work is unsaved, a prompt lets users name and save it first, or discard it.

### Fixed
- **New PDF confirmation overflow** — replaced the inline confirmation (clipped on PC/tablet) with a proper full-screen modal dialog.
- **Annotation gap in editor** — the "add annotation" (`+ note`) button was taking up height even when invisible, creating a visual gap between chords and lyrics on every unannotated line. Now hidden by default and revealed on line hover; touch devices show a compact version.

## [1.1.0] - 2026-06-30

### Added
- **Start from scratch** — create a blank song from the upload page without uploading a PDF.
- **Add songs to a set** — "+ New Song" adds a blank song; "+ Import PDF" appends songs from a second PDF file, without replacing the current set.
- **Duplicate detection** — when importing a PDF whose songs share titles with existing songs, a warning appears with options to add anyway or skip duplicates.
- **Reorder songs** — drag the ≡ handle in the song list to reorder songs. Works on touch screens. Reordering is recorded in the undo history.
- **Saved sessions** — snapshot any set under a name via the new "💾 Sessions" header button. Up to 20 sessions stored in browser localStorage. Supports save, load, rename, and delete.
- **Session export & import** — export any session as a `.wt` file (structured JSON), then re-import it on another device via the Sessions panel. Enables cross-device workflow without a server.
- **Beta auto-deploy** — the beta GitHub Pages deploy now triggers on every feature branch automatically (not just a single hardcoded branch name).

## [1.0.7] - 2026-06-30
- Fix the manual page's table of contents links navigating away to the landing page instead of scrolling to the target section.

## [1.0.6] - 2026-06-30
- Make tempo editable — click the BPM chip to set or clear it.
- Make the time signature pill editable — click it to change it (e.g. `3/4` → `4/4`).
- Add the ability to add, edit, and remove direction/bar-notation annotations on any lyric line.
- Fix inline-edit inputs (chord/tempo/annotation/time signature) silently losing focusability after the first one used in a session.

## [1.0.5] - 2026-06-30
- Show the app version in the header so the running build is always visible.

## [1.0.4] - 2026-06-30
- Fix the upload/landing page not scrolling when its content overflows a short viewport.
- Make chord drag-to-reposition work reliably on mobile and tablet by switching to Pointer Events (unifies mouse, touch, and pen input) and disabling native touch-scroll/zoom on chord buttons while dragging.
- Fix a bug where finishing a chord drag could immediately reopen the inline chord editor.

## [1.0.3] - 2026-06-30
- Add a full **`/manual`** page documenting every feature, linked from the header.
- Refresh the landing page with feature cards for Nashville numbers and undo/redo/dark mode/font size.
- Add a custom block-chord-notation favicon (SVG + multi-resolution ICO).
- Update README with the manual link, round-trip PDF note, and previously undocumented editing aids.

## [1.0.2] - 2026-06-30
- Add **undo/redo** history (up to 50 steps) with toolbar buttons and `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` shortcuts.
- Add **dark mode** toggle that follows system preference on first visit.
- Add **adjustable text size** (`A-` / `A+`), remembered between sessions.
- Improve the "clear/new PDF" UX.
- Add round-trip re-import support — PDFs exported by WorshipToolkit embed their column layout so re-uploading parses back exactly as left.
- Fix overlapping UI controls and expand font size options.

## [1.0.1] - 2026-06-30
- Add session persistence — work is saved to `localStorage` and restored on refresh.
- Add support for adding/removing/reordering song sections (drag-and-drop).
- Add line controls (add/remove chords and lines) via a left gutter, and chord drag-to-reposition.
- Add the **Nashville Number System** notation toggle.
- Add a responsive mobile/tablet layout.
- Switch GitHub Pages deploy to the `gh-pages` branch and add a `beta` deploy workflow for feature branches.

## [1.0.0] - 2026-06-29
- Initial release: upload and parse SongSelect PDF chord charts, including two-column layouts and superscript chord extensions (e.g. Fm⁷ → Fm7).
- Preserve direction notes (e.g. *To Tag*) and bar notation (e.g. `| Am7 | G |`) as annotations.
- Inline chord editing and transposition.
- Export to PDF and Markdown, matching the editor's layout, with annotations included and transposed correctly.
