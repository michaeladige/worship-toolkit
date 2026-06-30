# WorshipToolkit

A chord chart editor for worship teams. Upload a SongSelect PDF, edit and transpose the charts, and export a clean PDF or Markdown file ready to share.

**Live app:** https://michaeladige.github.io/worship-toolkit/
**Beta (in-progress features):** https://michaeladige.github.io/worship-toolkit/beta/

New to the app? Open **`/manual`** from the header (📖 Manual) for a full walkthrough of every feature below.

See [CHANGELOG.md](./CHANGELOG.md) for release history.

---

## Features

### PDF Import
- Drag-and-drop or file-picker upload for SongSelect chord chart PDFs
- Parses multi-song PDFs into individual songs automatically
- Handles two-column layouts, superscript chord extensions (e.g. Fm⁷ → Fm7)
- Preserves direction notes (e.g. *To Tag*, *To Interlude*) and bar notation (e.g. `| Am7 | G |`) as italic annotations
- Session is saved to `localStorage` — accidental refreshes restore your work; only the **+ New PDF** button resets
- **Round-trip friendly** — PDFs exported by WorshipToolkit embed their column layout, so re-uploading one parses back exactly as you left it

### Chord Editing
- Click any chord to rename it inline
- Drag any chord left/right to reposition it over the lyric
- Add chords to any line via the `+` gutter button on the left
- Remove individual chords with the `×` that appears on hover
- Add or remove entire lines and sections
- Drag-and-drop to reorder sections within a song
- Quick-add sections by name (INTRO / VERSE / CHORUS / PRE-CHORUS / BRIDGE / OUTRO / TAG) or enter a custom name
- Click the **BPM** chip in the toolbar to edit tempo; clear it to show a `+ BPM` placeholder
- Add, edit, or remove direction/bar-notation annotations on any lyric line — click an existing note to edit it, or use the **+ note** hover button on lines without one

### Key & Notation
- Transpose up/down by semitone with arrow buttons
- Jump directly to a target key via dropdown
- Reset to the original PDF key at any time
- **Bass Notes** toggle — displays only the root/bass note of every chord (great for beginner charts)
- **Nashville Number System** toggle — converts all chords to scale-degree numbers (1–7 with ♭/♯ prefixes), key-independent and useful for ear-trained players

### Export
- **Song PDF** — exports the current song as a two-column Courier-monospace PDF matching the editor layout
- **All PDF** — exports every song in the set in one file
- **Markdown** — exports the full set as a `.md` file with chord rows above lyrics, usable in any Markdown viewer
- All exports respect the current transposition, bass-notes toggle, and Nashville toggle
- Direction/bar notation annotations are included and transposed correctly

### Editing Aids
- **Undo / Redo** — every chord, lyric, and section edit is tracked (up to 50 steps); use the toolbar buttons or `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`
- **Dark mode** — toggle from the header; follows your system preference on first visit
- **Adjustable text size** — scale the whole app up or down with `A-` / `A+`, remembered between sessions

### Responsive UI
- Works on desktop, tablet, and mobile
- On mobile the song list collapses into a horizontal scrollable tab bar at the top

### In-App Manual
- A dedicated **`/manual`** page documents every feature above in plain language, with a jump-to table of contents
- Linked from the **📖 Manual** button in the app header on every page

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Angular 21 (standalone components, zoneless) |
| Routing | Angular Router |
| PDF parsing | pdfjs-dist |
| PDF export | jsPDF |
| Drag & drop | Angular CDK |
| Hosting | GitHub Pages via GitHub Actions |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4200)
ng serve

# Production build
ng build
```

### Branches & Deploy
- `main` → deploys to `https://michaeladige.github.io/worship-toolkit/`
- `feature/*` → deploys to `https://michaeladige.github.io/worship-toolkit/beta/`

Both deploy automatically on push via GitHub Actions (`.github/workflows/`).
