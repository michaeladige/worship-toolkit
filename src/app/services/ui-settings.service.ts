import { Injectable, signal } from '@angular/core';
import { Accidentals } from './chord.service';

export type Language = 'en' | 'la' | 'zh-TW' | 'id' | 'jv';
export type ColorTheme = 'blue' | 'pink' | 'red' | 'amber' | 'green';

const PREFS_KEY = 'worship_toolkit_prefs';

const LEGACY_THEME_KEY    = 'worship_toolkit_theme';
const LEGACY_FONT_KEY     = 'worship_toolkit_font_size';
const LEGACY_LATIN_KEY    = 'worship_toolkit_latin_mode';

const LANG_TOASTS: Record<Language, string> = {
  en:      'Switched to English 🌐',
  la:      'Modus Latinus Activatus 🏛️',
  'zh-TW': '已切換至繁體中文 🀄',
  id:      'Mode Bahasa Indonesia Aktif 🌴',
  jv:      'Basa Jawa sampun aktif 🌾',
};

const TRANSLATIONS: Record<string, Partial<Record<Language, string>>> = {
  // ── app header ──
  'Manual':     { la: 'Libellus',   'zh-TW': '手冊',         id: 'Panduan',        jv: 'Pandhuan'      },
  'New':        { la: 'Novum',      'zh-TW': '新增',         id: 'Baru',           jv: 'Anyar'         },
  'Untitled set': { la: 'Collectio Innominata', 'zh-TW': '未命名集合', id: 'Set Tanpa Nama', jv: 'Set Tanpa Jeneng' },
  'Export':     { la: 'Exportare',  'zh-TW': '匯出',         id: 'Ekspor',         jv: 'Ekspor'        },
  'Settings':   { la: 'Optiones',   'zh-TW': '設定',         id: 'Pengaturan',     jv: 'Setelan'       },

  // ── song editor toolbar ──
  '↩ Undo':     { la: '↩ Rescindere', 'zh-TW': '↩ 撤銷',   id: '↩ Batalkan',    jv: '↩ Bali'        },
  '↪ Redo':     { la: '↪ Refacere',   'zh-TW': '↪ 取消撤銷', id: '↪ Ulangi',    jv: '↪ Mbaleni'     },
  'Key':        { la: 'Clavis',     'zh-TW': '調性',         id: 'Kunci',          jv: 'Kunci'         },
  'Jump to':    { la: 'Salire ad',  'zh-TW': '跳至',         id: 'Lompat ke',      jv: 'Loncat menyang'},
  'Reset':      { la: 'Reponere',   'zh-TW': '重設',         id: 'Reset',          jv: 'Reset'         },
  '🎹 Bass Notes': { la: '🎹 Notae Bassi', 'zh-TW': '🎹 低音音符', id: '🎹 Not Bass', jv: '🎹 Not Bass' },
  '1 2 3 Nashville': { la: 'I II III Nashville', 'zh-TW': '1 2 3 納許維爾', id: '1 2 3 Nashville', jv: '1 2 3 Nashville' },
  'Add section':  { la: 'Addere Sectionem', 'zh-TW': '新增段落', id: 'Tambah Bagian', jv: 'Tambah Bagian' },
  'Custom name…': { la: 'Nomen proprium…', 'zh-TW': '自訂名稱…', id: 'Nama khusus…', jv: 'Jeneng dhewe…' },
  'Add':        { la: 'Addere',     'zh-TW': '新增',         id: 'Tambah',         jv: 'Tambah'        },

  // ── song section ──
  '+ Line':     { la: '+ Linea',    'zh-TW': '+ 行',         id: '+ Baris',        jv: '+ Baris'       },
  '+ chord':    { la: '+ chorda',   'zh-TW': '+ 和弦',       id: '+ akor',         jv: '+ akor'        },
  '+ note':     { la: '+ nota',     'zh-TW': '+ 備註',       id: '+ catatan',      jv: '+ cathetan'    },

  // ── song list ──
  'Songs in Set':    { la: 'Cantus in Collectione', 'zh-TW': '歌曲列表', id: 'Lagu dalam Set', jv: 'Lagu ing Set' },
  '+ New Song':      { la: '+ Cantus Novus', 'zh-TW': '+ 新歌', id: '+ Lagu Baru', jv: '+ Lagu Anyar'  },
  '+ Import PDF':    { la: '+ Importare PDF', 'zh-TW': '+ 匯入 PDF', id: '+ Impor PDF', jv: '+ Impor PDF' },
  'Importing…':      { la: 'Importando…', 'zh-TW': '匯入中…', id: 'Mengimpor…', jv: 'Ngimpor…'         },
  'Already in set:': { la: 'Iam in collectione:', 'zh-TW': '已在列表中：', id: 'Sudah ada:', jv: 'Wis ana:' },
  'Add anyway':      { la: 'Addere Nihilominus', 'zh-TW': '仍然新增', id: 'Tambah saja', jv: 'Tambah wae' },
  'Skip duplicates': { la: 'Omittere Similes', 'zh-TW': '跳過重複', id: 'Lewati duplikat', jv: 'Lewati duplikat' },
  'Cancel':          { la: 'Cancellare', 'zh-TW': '取消', id: 'Batal', jv: 'Batal'              },

  // ── export modal ──
  'Song PDF':              { la: 'PDF Cantus',                  'zh-TW': '歌曲 PDF',       id: 'PDF Lagu',            jv: 'PDF Lagu'           },
  'Current song only':     { la: 'Solum cantus currens',        'zh-TW': '僅目前歌曲',     id: 'Lagu ini saja',       jv: 'Lagu iki wae'       },
  'Set PDF':               { la: 'PDF Collectionis',            'zh-TW': '全集 PDF',       id: 'PDF Set',             jv: 'PDF Set'            },
  'All songs in one file': { la: 'Omnes cantus in uno fasciculo', 'zh-TW': '所有歌曲合一檔', id: 'Semua lagu satu file', jv: 'Kabeh lagu siji file' },
  'Full set as .md file':  { la: 'Collectio ut fasciculus .md', 'zh-TW': '全集 .md 檔',    id: 'Set lengkap .md',     jv: 'Set lengkap .md'    },
  'Generating…':           { la: 'Generando…',                  'zh-TW': '產生中…',        id: 'Membuat…',            jv: 'Digawe…'            },

  // ── settings modal ──
  'Appearance':   { la: 'Aspectus',          'zh-TW': '外觀',         id: 'Tampilan',       jv: 'Tampilan'      },
  'Color':        { la: 'Color',             'zh-TW': '顏色',         id: 'Warna',          jv: 'Warna'         },
  'Theme':        { la: 'Thema',             'zh-TW': '主題',         id: 'Tema',           jv: 'Tema'          },
  'Light':        { la: 'Lux',               'zh-TW': '淺色',         id: 'Terang',         jv: 'Padhang'       },
  'Dark':         { la: 'Tenebrae',          'zh-TW': '深色',         id: 'Gelap',          jv: 'Peteng'        },
  'Accidentals':  { la: 'Accidentalia',      'zh-TW': '升降記號',     id: 'Tanda Nada',     jv: 'Tanda Nada'    },
  'Flats':        { la: 'Bemolia',           'zh-TW': '降號 (♭)',    id: 'Mol (♭)',         jv: 'Mol (♭)'       },
  'Auto':         { la: 'Automatice',        'zh-TW': '自動',         id: 'Otomatis',       jv: 'Otomatis'      },
  'Sharps':       { la: 'Diesis',            'zh-TW': '升號 (♯)',    id: 'Kres (♯)',        jv: 'Kres (♯)'      },
  'Text size':    { la: 'Magnitudo Textus',  'zh-TW': '文字大小',     id: 'Ukuran Teks',    jv: 'Ukuran Teks'   },
  'PDF font size':{ la: 'Magnitudo PDF',     'zh-TW': 'PDF 字型大小', id: 'Ukuran Font PDF',jv: 'Ukuran Font PDF'},
  'Language':     { la: 'Lingua',            'zh-TW': '語言',         id: 'Bahasa',         jv: 'Basa'          },
  '⚠️ Above 14px PDFs use a single column — lyrics may still wrap.': {
    la:      '⚠️ Supra 14px PDF unam columnam adhibet — verba adhuc frangi possunt.',
    'zh-TW': '⚠️ 超過 14px 時，PDF 使用單欄版面，歌詞可能自動換行。',
    id:      '⚠️ Di atas 14px, PDF menggunakan satu kolom — lirik mungkin masih terbungkus.',
    jv:      '⚠️ Yen ngluwihi 14px, PDF nggunakake siji kolom — lirik bisa tetep dibungkus.',
  },

  // ── sessions modal ──
  'Saved Sets':      { la: 'Collectiones Servatae', 'zh-TW': '已儲存集合',     id: 'Set Tersimpan',       jv: 'Set Kasimpen'        },
  '+ New':           { la: '+ Novum',               'zh-TW': '+ 新增',         id: '+ Baru',              jv: '+ Anyar'             },
  'Modified':        { la: 'Mutatum',               'zh-TW': '修改於',         id: 'Diubah',              jv: 'Diowahi'             },
  'Unsaved set':     { la: 'Collectio Non Servata', 'zh-TW': '未儲存集合',     id: 'Set Belum Disimpan',  jv: 'Set Durung Kasimpen' },
  'Set name…':       { la: 'Nomen Collectionis…',   'zh-TW': '集合名稱…',      id: 'Nama set…',           jv: 'Jeneng set…'         },
  'Save':            { la: 'Servare',               'zh-TW': '儲存',           id: 'Simpan',              jv: 'Simpen'              },
  '↑ Import .wt file': { la: '↑ Importare Fasciculum .wt', 'zh-TW': '↑ 匯入 .wt 檔', id: '↑ Impor file .wt', jv: '↑ Impor file .wt' },
  'No saved sets yet. Enter a name above and click Save.': {
    la:      'Nulla collectio servata. Inscribere nomen et premere Servare.',
    'zh-TW': '尚無已儲存集合。請在上方輸入名稱並點擊儲存。',
    id:      'Belum ada set tersimpan. Masukkan nama dan klik Simpan.',
    jv:      'Durung ana set kasimpen. Tulis jeneng banjur klik Simpen.',
  },
  'songs':     { la: 'cantus', 'zh-TW': '首歌', id: 'lagu', jv: 'lagu' },
  'song':      { la: 'cantus', 'zh-TW': '首歌', id: 'lagu', jv: 'lagu' },
  'active':    { la: 'activum','zh-TW': '使用中', id: 'aktif', jv: 'aktif' },
  'Load':      { la: 'Onerare','zh-TW': '載入',  id: 'Muat',  jv: 'Muat'  },
  'You have unsaved work. Enter a name to keep it, or skip to discard.': {
    la:      'Habes laborem non servatum. Inscribere nomen ut serves, vel omitte ut omittas.',
    'zh-TW': '您有未儲存的內容。輸入名稱以保留，或跳過放棄。',
    id:      'Ada pekerjaan belum disimpan. Masukkan nama untuk menyimpan, atau lewati.',
    jv:      'Ana gaweyan durung kasimpen. Tulis jeneng kanggo nyimpen, utawa lewati.',
  },
  'Set name (optional)…': { la: 'Nomen (optionale)…', 'zh-TW': '集合名稱（選填）…', id: 'Nama set (opsional)…', jv: 'Jeneng set (opsional)…' },
  'Save & New':  { la: 'Servare & Novum',   'zh-TW': '儲存並新增', id: 'Simpan & Baru',    jv: 'Simpen & Anyar'   },
  'Skip & New':  { la: 'Omittere & Novum',  'zh-TW': '跳過並新增', id: 'Lewati & Baru',    jv: 'Lewati & Anyar'   },

  // ── upload page — hero ──
  'WorshipToolkit': {
    la:      'Arca Musica 🏛️',
    'zh-TW': '讚美神器 🀄',
    id:      'Koper Pujian 🌴',
    jv:      'Piranti Puji-Pujian 🌾',
  },
  'Upload a SongSelect PDF to edit keys, transpose chords, and export your set': {
    la:      'Trade mihi PDF et carmina tua in ordinem redigentur',
    'zh-TW': '丟個 PDF 進來，我幫你轉調，你負責唱歌！',
    id:      'Upload PDF kamu, kami yang atur nadanya, kamu yang nyanyi!',
    jv:      'Lebokno PDF-mu, aku sing ngurus lagune, kowe sing nyanyi!',
  },

  // ── upload page — other ──
  'Parsing PDF…':    { la: 'Legendo PDF…',          'zh-TW': '解析 PDF 中…',  id: 'Memproses PDF…',       jv: 'Ngolah PDF…'          },
  'Drag & drop your SongSelect PDF here': {
    la: 'Huc trahere documentum PDF',
    'zh-TW': '將 SongSelect PDF 拖放到此處',
    id: 'Seret PDF SongSelect ke sini',
    jv: 'Seret PDF SongSelect mrene',
  },
  'or':              { la: 'vel',                   'zh-TW': '或',             id: 'atau',                 jv: 'utawa'                },
  'Choose File':     { la: 'Eligere Fasciculum',     'zh-TW': '選擇檔案',       id: 'Pilih File',           jv: 'Pilih File'           },
  '✏️ Start from scratch': { la: '✏️ Incipere ab Initio', 'zh-TW': '✏️ 從頭開始', id: '✏️ Mulai dari awal', jv: '✏️ Miwiti saka nol'  },
  '📂 Load set file': { la: '📂 Onerare Fasciculum', 'zh-TW': '📂 載入集合檔案', id: '📂 Muat file set',    jv: '📂 Muat file set'     },
  'Transpose Keys':  { la: 'Claves Transponere',    'zh-TW': '轉調',           id: 'Transpose Nada',       jv: 'Transpose Nada'       },
  'Shift the entire song up or down by semitones, or jump directly to a target key': {
    la:      'Totum cantum sursum vel deorsum per semitonos muta, vel salta ad clavem destinatam',
    'zh-TW': '將整首歌上移或下移半音，或直接跳至目標調性',
    id:      'Geser nada lagu secara keseluruhan, atau langsung ke nada target',
    jv:      'Geser nada lagu, utawa langsung menyang nada sing dikarepake',
  },
  'Edit Chords':     { la: 'Chordas Emendare',      'zh-TW': '編輯和弦',       id: 'Edit Akor',            jv: 'Edit Akor'            },
  'Click any chord to rename it inline, or change individual chord placements': {
    la:      'Clicca chordas ut renomines in situ, vel muta positiones chordas singularum',
    'zh-TW': '點擊任意和弦以重新命名，或調整和弦位置',
    id:      'Klik akor untuk mengganti nama, atau ubah posisi akor',
    jv:      'Klik akor kanggo ngganti jeneng, utawa ngowahi posisine',
  },
  'Bass Notes':      { la: 'Notae Bassi',            'zh-TW': '低音音符',       id: 'Not Bass',             jv: 'Not Bass'             },
  'Toggle to show just the root/bass note of every chord — great for beginners': {
    la:      'Commuta ut solum notam radicem/bassi cuiusque chordae videas — optimum pro initiis',
    'zh-TW': '切換顯示每個和弦的根音/低音，適合初學者',
    id:      'Tampilkan hanya not bass dari setiap akor — cocok untuk pemula',
    jv:      'Tampilake mung not bass saben akor — cocok kanggo pemula',
  },
  'Download updated sheet as a formatted PDF or Markdown file to share with your team': {
    la:      'Descarga schedam renovatam ut PDF formatum vel Markdown ad socios tuos',
    'zh-TW': '下載更新後的樂譜為 PDF 或 Markdown 格式以分享給團隊',
    id:      'Unduh lembaran sebagai PDF atau Markdown untuk dibagikan ke tim',
    jv:      'Undhuh lembar minangka PDF utawa Markdown kanggo dibagi',
  },
  'Nashville Numbers': { la: 'Numeri Nashville',     'zh-TW': '納許維爾數字',   id: 'Nomor Nashville',      jv: 'Nomor Nashville'      },
  'Switch every chord to scale-degree numbers — key-independent charts for ear-trained players': {
    la:      'Muta omnes chordas ad numeros graduum — chartae independentes pro musicis auribus exercitatis',
    'zh-TW': '將每個和弦轉換為音階度數數字，與調性無關',
    id:      'Ubah setiap akor menjadi nomor skala — bebas kunci!',
    jv:      'Ganti saben akor dadi nomor skala — bebas kunci!',
  },
  'Undo, Dark Mode & More': {
    la:      'Rescindere, Modus Obscurus & Plus',
    'zh-TW': '撤銷、深色模式等',
    id:      'Batalkan, Mode Gelap & Lainnya',
    jv:      'Bali, Mode Peteng & Liyane',
  },
  'Full undo/redo history, a dark theme, and adjustable text size — all remembered between visits': {
    la:      'Historia plena rescindendi/refaciendi, thema obscurum, et magnitudo textus adaptabilis — omnia inter visitas memoria tenentur',
    'zh-TW': '完整撤銷/取消撤銷記錄、深色主題、文字大小調整 — 跨訪問記憶',
    id:      'Riwayat undo/redo penuh, tema gelap, ukuran teks — semua tersimpan',
    jv:      'Riwayat undo/redo lengkap, tema peteng, ukuran teks — kabeh kasimpen',
  },
  '📖 New here? Read the full user manual →': {
    la:      '📖 Novus hic? Lege manuale completum →',
    'zh-TW': '📖 第一次使用？閱讀完整使用手冊 →',
    id:      '📖 Baru di sini? Baca panduan lengkap →',
    jv:      '📖 Anyar ing kene? Waca pandhuan lengkap →',
  },
  '🧪 Try the beta — new features land here first →': {
    la:      '🧪 Experire betam — nova hic primo adsunt →',
    'zh-TW': '🧪 試用 Beta 版 — 新功能先在這裡登場 →',
    id:      '🧪 Coba versi beta — fitur baru hadir di sini lebih awal →',
    jv:      '🧪 Coba beta — fitur anyar teka dhisik ing kene →',
  },
};

@Injectable({ providedIn: 'root' })
export class UiSettingsService {
  theme: 'light' | 'dark' = 'light';
  fontSize = 14;
  readonly fontSizes = [13, 14, 16, 18, 20, 24, 28, 32];

  pdfFontSize = 14;
  readonly pdfFontSizes = [10, 12, 14, 16, 18, 20];

  chordAccidentals: Accidentals = 'auto';

  language: Language = 'en';

  colorTheme: ColorTheme = 'blue';
  readonly colorThemes: ColorTheme[] = ['blue', 'pink', 'red', 'amber', 'green'];

  readonly toastMsg = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showSettingsModal = false;
  openSettingsModal()  { this.showSettingsModal = true; }
  closeSettingsModal() { this.showSettingsModal = false; }

  get latinMode(): boolean { return this.language === 'la'; }

  t(key: string): string {
    if (this.language === 'en') return key;
    return TRANSLATIONS[key]?.[this.language] ?? key;
  }

  setLanguage(lang: Language, silent = false) {
    this.language = lang;
    this.savePrefs();
    if (!silent) {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastMsg.set(LANG_TOASTS[lang]);
      this.toastTimer = setTimeout(() => this.toastMsg.set(''), 3000);
    }
  }

  setColorTheme(color: ColorTheme) {
    this.colorTheme = color;
    this.savePrefs();
    this.applyColorTheme();
  }

  init() {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as Record<string, unknown>;
        this.theme    = (p['theme'] === 'light' || p['theme'] === 'dark') ? p['theme'] as 'light' | 'dark'
                      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const sz = (p['fontSize'] as number) ?? 14;
        this.fontSize = this.fontSizes.includes(sz) ? sz : 14;
        const psz = (p['pdfFontSize'] as number) ?? 14;
        this.pdfFontSize = this.pdfFontSizes.includes(psz) ? psz : 14;
        const acc = p['chordAccidentals'] as string;
        this.chordAccidentals = (acc === 'sharps' || acc === 'flats') ? acc : 'auto';
        // language: prefer new 'language' key, fall back to old 'latinMode' boolean
        const lang = p['language'] as string;
        if (lang && ['en','la','zh-TW','id','jv'].includes(lang)) {
          this.language = lang as Language;
        } else {
          this.language = p['latinMode'] === true ? 'la' : 'en';
        }
        const ct = p['colorTheme'] as string;
        this.colorTheme = (this.colorThemes as string[]).includes(ct) ? ct as ColorTheme : 'blue';
      } catch {
        this.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } else {
      const oldTheme = localStorage.getItem(LEGACY_THEME_KEY) as 'light' | 'dark' | null;
      this.theme = (oldTheme === 'light' || oldTheme === 'dark') ? oldTheme
                 : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const oldSize = parseInt(localStorage.getItem(LEGACY_FONT_KEY) ?? '', 10);
      if (this.fontSizes.includes(oldSize)) this.fontSize = oldSize;
      this.language = localStorage.getItem(LEGACY_LATIN_KEY) === 'true' ? 'la' : 'en';
      this.savePrefs();
      [LEGACY_THEME_KEY, LEGACY_FONT_KEY, LEGACY_LATIN_KEY].forEach(k => localStorage.removeItem(k));
    }
    this.applyTheme();
    this.applyFontSize();
    this.applyColorTheme();
  }

  private savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      theme: this.theme,
      fontSize: this.fontSize,
      pdfFontSize: this.pdfFontSize,
      chordAccidentals: this.chordAccidentals,
      language: this.language,
      colorTheme: this.colorTheme,
    }));
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.savePrefs();
    this.applyTheme();
  }

  adjustFontSize(dir: 1 | -1) {
    const idx = this.fontSizes.indexOf(this.fontSize);
    const newIdx = Math.max(0, Math.min(this.fontSizes.length - 1, idx + dir));
    this.fontSize = this.fontSizes[newIdx];
    this.savePrefs();
    this.applyFontSize();
  }

  setChordAccidentals(val: Accidentals) {
    this.chordAccidentals = val;
    this.savePrefs();
  }

  adjustPdfFontSize(dir: 1 | -1) {
    const idx = this.pdfFontSizes.indexOf(this.pdfFontSize);
    const newIdx = Math.max(0, Math.min(this.pdfFontSizes.length - 1, idx + dir));
    this.pdfFontSize = this.pdfFontSizes[newIdx];
    this.savePrefs();
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  private applyFontSize() {
    document.documentElement.style.fontSize = this.fontSize + 'px';
  }

  private applyColorTheme() {
    if (this.colorTheme === 'blue') document.documentElement.removeAttribute('data-color');
    else document.documentElement.setAttribute('data-color', this.colorTheme);
  }
}
