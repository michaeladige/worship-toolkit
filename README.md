# WorshipToolkit

A chord chart editor for worship teams. Upload a SongSelect PDF, edit and transpose the charts, build multi-song sets, and export clean PDFs or Markdown files ready to share.

**Live app:** https://michaeladige.github.io/worship-toolkit/
**Beta (in-progress features):** https://michaeladige.github.io/worship-toolkit/beta/

New to the app? Open **`/manual`** from the header (📖 Manual) for a full walkthrough of every feature.

See [CHANGELOG.md](./CHANGELOG.md) for release history.

---

## Features

### PDF Import & Song Sets
- Drag-and-drop or file-picker upload for SongSelect chord chart PDFs
- Parses multi-song PDFs into individual songs automatically
- Handles two-column layouts, superscript chord extensions (e.g. Fm⁷ → Fm7)
- Preserves direction notes (e.g. *To Tag*) and bar notation (e.g. `| Am7 | G |`) as italic annotations
- **Start from scratch** — create a blank song without a PDF
- **Append songs** — add a blank song or import from another PDF without replacing your current set; duplicate title detection warns before adding
- **Drag-to-reorder** songs via the ≡ handle (mouse and touch)
- **Remove songs** — hover a song in the list and click ✕; removing the last song returns to the upload screen
- **Round-trip friendly** — PDFs exported by WorshipToolkit embed their column layout, so re-uploading one parses back exactly as you left it

### Saved Sets & Autosave
- **Saved sets** — snapshot any set under a name via **💾 Sessions**; up to 20 sets stored in browser localStorage
- **Autosave** — once a set is named or loaded, every edit saves to it automatically in real time
- **Set export/import** — export any set as a `.wt` file (structured JSON); re-import it on another device via the Sessions panel or the upload page
- **Active set indicator** — Sessions panel shows the current set name and last-modified time at the top; each list item also shows when it was last saved
- Active set is remembered across page reloads — your work survives refreshes

### Chord Editing
- Click any chord to rename it inline
- Drag any chord left/right to reposition it precisely over the lyric
- Add chords via the `+` gutter button; remove with the `×` that appears on hover
- Add, remove, and reorder entire lines and sections
- Drag-and-drop to reorder sections within a song
- Quick-add sections by name (INTRO / VERSE / CHORUS / PRE-CHORUS / BRIDGE / OUTRO / TAG) or enter a custom name
- **Inline song title editing** — click the song title in the toolbar to rename; press Enter to save or Esc to cancel
- Click the **BPM** chip to set or clear tempo
- Click the time signature chip (e.g. `4/4`) to change it (e.g. to `3/4` or `6/8`)
- Add, edit, or remove direction/bar-notation annotations on any lyric line

### Key & Notation
- Transpose up/down by semitone with arrow buttons, or jump directly to a target key
- **Accidentals preference** — choose ♭ Flats, Auto (key-context), or ♯ Sharps; applies everywhere simultaneously (editor, toolbar, exports)
- Reset to the original PDF key at any time
- **Bass Notes** toggle — displays only the root/bass note of every chord
- **Nashville Number System** toggle — converts all chords to scale-degree numbers (1–7 with ♭/♯ prefixes), relative to the current key

### Export
- **Song PDF** — exports the current song as a clean monospace chord chart PDF (two-column at default 14 px, single-column at larger sizes)
- **Set PDF** — exports every song in the set in one file, in list order
- **Markdown** — exports the full set as a `.md` file with chord rows above lyrics
- All exports respect the current transposition, bass-notes toggle, Nashville toggle, accidentals preference, and annotations
- **PDF font size** — configurable independently from the on-screen text size (10–20 px, default 14 px) via ⚙️ Settings

### Appearance & Accessibility
- **Color themes** — five accent color themes in ⚙️ Settings → Appearance: Blue (default), Pink, Red, Amber, Green; each works with both light and dark mode
- **Light / Dark mode** — toggle from ⚙️ Settings; follows system preference on first visit
- **Chord font** — choose Classic (Courier New) or Readable (JetBrains Mono, the default) in ⚙️ Settings → Appearance; both are true monospace fonts so chord/lyric alignment stays exact, and the choice applies to both the editor and PDF exports
- **Adjustable text size** — scale the app up or down with A− / A+ (13–32 px), remembered between visits
- **Split-column view** — toggle in ⚙️ Settings → Appearance to arrange the editor into two columns on tablet/desktop, mirroring the same layout rule as two-column PDF exports (14 px text size or below); mobile always shows a single column

### Multi-Language UI
- Five UI languages selectable via ⚙️ Settings → Language or from the pill row at the top of the manual page:
  - 🌐 **English** (default)
  - 🏛️ **Latina** — humorous Latin; unlocks a hidden *Cantus Secretus* on the manual page
  - 🀄 **繁體中文** — Traditional Chinese
  - 🌴 **Bahasa Indonesia**
  - 🌾 **Basa Jawa** — Javanese
- Every language switch shows a toast notification
- Language preference is saved per set and restored when that set is loaded
- The home page app name and tagline adapt per language
- The full user manual (§1–§11) is translated into all four non-English languages, each with a distinct humorous tone

### Responsive UI
- Works on desktop, tablet, and mobile
- **Desktop/tablet sidebar** — collapses to a 32 px strip with ◄/► for more editor space; `+ New Song` and `+ Import PDF` sit at the end of the song list as always-visible buttons
- **Mobile tab bar** — song list becomes a horizontal scrollable strip at the top; collapses with a tap to free vertical space; drag handle visible for touch reordering; `+` toggle at the end of the strip expands add-song options

### In-App Manual
- A dedicated **`/manual`** page documents every feature in plain language, with a collapsible changelog and jump-to table of contents
- Fully translated into all five app languages (§12 changelog stays in English)
- Linked from the **📖 Manual** button in the app header

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Angular 21 (standalone components, zoneless) |
| Routing | Angular Router |
| PDF parsing | pdfjs-dist |
| PDF export | jsPDF |
| Drag & drop | Angular CDK |
| Fonts | Courier New (system), JetBrains Mono (self-hosted, [OFL-1.1](./public/fonts/JetBrainsMono-OFL.txt)) |
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
