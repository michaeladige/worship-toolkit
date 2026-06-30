# Changelog

All notable changes to WorshipToolkit are documented here. Versions follow `MAJOR.MINOR.PATCH`.

## [1.0.6] - 2026-06-30
- Make tempo editable — click the BPM chip to set or clear it.
- Add the ability to add, edit, and remove direction/bar-notation annotations on any lyric line.
- Fix inline-edit inputs (chord/tempo/annotation) silently losing focusability after the first one used in a session.

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
