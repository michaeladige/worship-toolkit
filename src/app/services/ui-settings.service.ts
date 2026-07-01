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
  id:      'Mode Bahasa Indonesia: ON! Gaskeun, lur 🌴🔥',
  jv:      'Basa Jawa sampun mlebu, Cah! Ayo garap lagune karo tentrem 🌾😌',
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
    id:      'Upload PDF kamu, biar kita yang atur nadanya, kamu tinggal nyanyi — gaskeun!',
    jv:      'Lebokna PDF-mu, Cah, ben tak-urus lagune, kowe kari nyanyi karo ngguyu 😊',
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
    id:      'Geser nada lagu naik-turun sesuka hati, atau langsung cus ke nada target — gak pake ribet!',
    jv:      'Geser nada lagu alon-alon utawa langsung mlumpat menyang nada sing dikarepake, ora perlu kesusu, Cah.',
  },
  'Edit Chords':     { la: 'Chordas Emendare',      'zh-TW': '編輯和弦',       id: 'Edit Akor',            jv: 'Edit Akor'            },
  'Click any chord to rename it inline, or change individual chord placements': {
    la:      'Clicca chordas ut renomines in situ, vel muta positiones chordas singularum',
    'zh-TW': '點擊任意和弦以重新命名，或調整和弦位置',
    id:      'Klik akor mana aja buat ganti nama, atau geser posisinya sesuka hati — anti ribet!',
    jv:      'Klik akor sing dikarepake kanggo ngganti jeneng, utawa geser panggonane, alon-alon ora perlu kesusu.',
  },
  'Bass Notes':      { la: 'Notae Bassi',            'zh-TW': '低音音符',       id: 'Not Bass',             jv: 'Not Bass'             },
  'Toggle to show just the root/bass note of every chord — great for beginners': {
    la:      'Commuta ut solum notam radicem/bassi cuiusque chordae videas — optimum pro initiis',
    'zh-TW': '切換顯示每個和弦的根音/低音，適合初學者',
    id:      'Tampilin cuma not bass tiap akor — cocok banget buat pemula yang masih newbie!',
    jv:      'Tampilake mung not bass saben akor — pas kanggo sing lagi sinau, ora usah kesusu.',
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
    id:      'Ubah semua akor jadi angka skala — bebas kunci, buat kamu yang kupingnya udah jago!',
    jv:      'Ganti saben akor dadi angka skala — bebas kunci, kanggo sing kupinge wis pinter.',
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
    id:      'Riwayat undo/redo lengkap, tema gelap buat begadang, ukuran teks bisa diatur — semua diinget, santuy!',
    jv:      'Riwayat undo/redo lengkap, tema peteng kanggo sing seneng ngedit bengi, ukuran teks iso disetel — kabeh dieling-eling, tenang wae.',
  },
  '📖 New here? Read the full user manual →': {
    la:      '📖 Novus hic? Lege manuale completum →',
    'zh-TW': '📖 第一次使用？閱讀完整使用手冊 →',
    id:      '📖 Baru gabung? Cus baca manualnya biar gak nyasar →',
    jv:      '📖 Anyar mrene, Cah? Wacanen pandhuane sik, ben ora bingung →',
  },
  '🧪 Try the beta — new features land here first →': {
    la:      '🧪 Experire betam — nova hic primo adsunt →',
    'zh-TW': '🧪 試用 Beta 版 — 新功能先在這裡登場 →',
    id:      '🧪 Cobain versi beta — fitur baru mejeng di sini duluan, jadi anak paling update!',
    jv:      '🧪 Coba beta, Cah — fitur anyar mrene dhisik, kowe dadi sing paling ngerti dhisik →',
  },

  // ── manual page — header ──
  '← Back to WorshipToolkit': {
    la:      '← Redi ad Arcam Musicam',
    'zh-TW': '← 返回讚美神器',
    id:      '← Balik ke Koper Pujian',
    jv:      '← Bali menyang Piranti Puji-Pujian',
  },
  'User Manual': {
    la:      'Manuale Civium',
    'zh-TW': '使用手冊',
    id:      'Buku Panduan',
    jv:      'Buku Tuntunan',
  },
  'Everything you need to upload, edit, transpose, and share chord charts with your worship team.': {
    la:      'Omnia quae tibi opus sunt ad documenta chordarum chori tui sacri importandum, emendandum, transponendum et communicandum. Senatus Romanus adprobat.',
    'zh-TW': '姐幫你整理好了——上傳、編輯、移調、分享，一條龍全搞定！',
    id:      'Semua yang lo butuhin buat upload, edit, transpose, dan share chord ke tim praise — semuanya ada di sini, no drama, gaskeun!',
    jv:      'Kabeh sing kok butuhake kanggo upload, ngedit, transpose, lan ngedum chord karo tim puji-pujian, ora usah bingung, nak.',
  },

  // ── manual page — TOC ──
  'On this page': {
    la:      'In hac pagina',
    'zh-TW': '本頁內容',
    id:      'Di halaman ini',
    jv:      'Ing kaca iki',
  },
  '1. Getting started': {
    la:      'I. Initium Faciendum Est',
    'zh-TW': '1. 開始使用',
    id:      '1. Cara Mulai',
    jv:      '1. Wiwitan',
  },
  '2. Your song set': {
    la:      'II. Collectio Cantuum Tuorum',
    'zh-TW': '2. 你的歌曲集合',
    id:      '2. Set Lagu Kamu',
    jv:      '2. Set Lagumu',
  },
  '3. Editing chords & lyrics': {
    la:      'III. Emendatio Chordarum & Verborum',
    'zh-TW': '3. 編輯和弦與歌詞',
    id:      '3. Edit Akor & Lirik',
    jv:      '3. Ngedit Akor & Lirik',
  },
  '4. Working with sections': {
    la:      'IV. De Laborando cum Sectionibus',
    'zh-TW': '4. 使用段落',
    id:      '4. Bekerja dengan Bagian Lagu',
    jv:      '4. Nggarap Bagian Lagu',
  },
  '5. Keys & transposition': {
    la:      'V. Claves & Transpositio',
    'zh-TW': '5. 調性與移調',
    id:      '5. Kunci & Transposisi',
    jv:      '5. Kunci & Transpose',
  },
  '6. Bass notes & Nashville numbers': {
    la:      'VI. Notae Bassi & Numeri Nashville',
    'zh-TW': '6. 低音音符與納許維爾數字',
    id:      '6. Not Bass & Nomor Nashville',
    jv:      '6. Not Bass & Nomor Nashville',
  },
  '7. Undo & redo': {
    la:      'VII. Rescindere & Refacere',
    'zh-TW': '7. 撤銷與取消撤銷',
    id:      '7. Batalkan & Ulangi',
    jv:      '7. Bali & Mbaleni',
  },
  '8. Exporting & sharing': {
    la:      'VIII. Exportatio & Communicatio',
    'zh-TW': '8. 匯出與分享',
    id:      '8. Ekspor & Berbagi',
    jv:      '8. Ekspor & Bagi-Bagi',
  },
  '9. Saved sets & autosave': {
    la:      'IX. Collectiones Servatae & Custodia Automatica',
    'zh-TW': '9. 已儲存集合與自動儲存',
    id:      '9. Set Tersimpan & Autosave',
    jv:      '9. Set Kasimpen & Simpen Otomatis',
  },
  '10. Appearance & accessibility': {
    la:      'X. Aspectus & Accessibilitas',
    'zh-TW': '10. 外觀與無障礙設定',
    id:      '10. Tampilan & Aksesibilitas',
    jv:      '10. Tampilan & Aksesibilitas',
  },
  '11. Tips, autosave & troubleshooting': {
    la:      'XI. Consilia, Custodia Automatica & Remedia',
    'zh-TW': '11. 技巧、自動儲存與疑難排解',
    id:      '11. Tips, Autosave & Pemecahan Masalah',
    jv:      '11. Tips, Simpen Otomatis & Ngatasi Masalah',
  },

  // ── §1 Getting started ──
  'WorshipToolkit turns a SongSelect chord chart PDF into an editable, transposable chart you can reshape and export. Everything happens in your browser — nothing is uploaded to a server.': {
    la:      'WorshipToolkit documentum PDF chordarum SongSelect in tabulam editabilem et transponibilem mutat, quam reformare et exportare potes. Omnia in navigatro tuo fiunt — nihil ad servitorem transmittitur. Magnum est!',
    'zh-TW': 'WorshipToolkit 把你的 SongSelect PDF 變成可以隨意編輯、移調的和弦圖，全部在你的瀏覽器裡搞定——沒有任何東西被上傳到伺服器，姐保證！',
    id:      'WorshipToolkit ubah PDF chord SongSelect kamu jadi chart yang bisa diedit dan ditranspose sesuka hati. Semua terjadi di browser kamu — gak ada yang diupload ke server, sumpah deh, aman total!',
    jv:      'WorshipToolkit ngowahi PDF chord SongSelect dadi chart sing iso diedit lan ditranspose, nak. Kabeh kedadean ing browser-mu — ora ana sing diunggah menyang server, tentrem uwis, ora usah kuatir.',
  },
  'Open the app and either': {
    la:      'Aperi applicationem et aut',
    'zh-TW': '打開 App，然後可以',
    id:      'Buka app-nya, terus',
    jv:      'Bukak app-e, banjur',
  },
  'a SongSelect PDF onto the drop zone, click': {
    la:      'documentum SongSelect PDF in zonam disponendi, vel premes',
    'zh-TW': 'SongSelect PDF 拖到這裡，或點',
    id:      'PDF SongSelect ke area drop, klik',
    jv:      'PDF SongSelect menyang area drop, utawa klik',
  },
  'to pick one, click': {
    la:      'ut unum elicias, vel',
    'zh-TW': '選擇一個檔案，或點',
    id:      'untuk pilih file, klik',
    jv:      'kanggo milih file, utawa klik',
  },
  'to create a blank song, or click': {
    la:      'ut cantum vacuum crees, vel premes',
    'zh-TW': '新建空白歌曲，或點',
    id:      'untuk buat lagu kosong, atau klik',
    jv:      'gawe lagu kosong, utawa klik',
  },
  'to resume from a previously exported': {
    la:      'ut e fasciculo antea exportato resumas',
    'zh-TW': '繼續先前匯出的',
    id:      'untuk lanjutin dari file',
    jv:      'kanggo nerusake saka file',
  },
  'file.': {
    la:      'fasciculo.',
    'zh-TW': '檔案。',
    id:      'yang pernah diekspor.',
    jv:      'sing tau diekspor.',
  },
  'The app parses the PDF automatically. Multi-song PDFs are split into individual songs.': {
    la:      'Applicatio PDF automatice legit. Documenta PDF cum multis cantibus in cantus singulos dividuntur. Mirabile dictu!',
    'zh-TW': 'App 會自動解析 PDF 喔！包含多首歌的 PDF 也會自動拆分成單曲，不用你手動一首首來。',
    id:      'App otomatis parsing PDF-nya. PDF yang isinya banyak lagu langsung dipecah jadi lagu-lagu terpisah — mantap jiwa!',
    jv:      'App iki otomatis ngurai PDF-e, nak. PDF sing isi akeh lagu langsung dipisah dadi lagu siji-siji.',
  },
  'Two-column layouts and superscript chord extensions (e.g.': {
    la:      'Dispositiones bicolumnes et extensiones chordarum superscriptae (e.g.',
    'zh-TW': '雙欄排版和上標和弦延伸音（例如',
    id:      'Layout dua kolom dan ekstensi chord superscript (mis.',
    jv:      'Layout rong kolom lan ekstensi chord superscript (tuladha',
  },
  'are recognized and normalized automatically (e.g. to': {
    la:      'agnoscantur et normalizantur automatice (e.g. ad',
    'zh-TW': '）都會自動識別並標準化（例如轉為',
    id:      ') dikenali dan dinormalisasi otomatis (mis. jadi',
    jv:      ') dikenali lan dinormalisasi otomatis (tuladha dadi',
  },
  ').': {
    la:      ').',
    'zh-TW': '）。',
    id:      ').',
    jv:      ').',
  },
  'Direction notes such as': {
    la:      'Notae directionis ut',
    'zh-TW': '方向標記如',
    id:      'Catatan arah seperti',
    jv:      'Cathetan arah kaya',
  },
  ', and bar notation like': {
    la:      ', et notatio barrarum sicut',
    'zh-TW': '，以及小節符號如',
    id:      ', dan notasi bar seperti',
    jv:      ', lan notasi bar kaya',
  },
  ', are preserved as italic annotations under the relevant line.': {
    la:      ', ut annotationes italicae sub linea pertinenti servantur.',
    'zh-TW': '，都會以斜體標記保留在相關行的下方。',
    id:      ', disimpan sebagai anotasi miring di bawah baris yang sesuai.',
    jv:      ', disimpen minangka anotasi miring ing ngisor baris sing cocog.',
  },
  'Only PDF files are supported.': {
    la:      'Solum fascicula PDF sustentantur.',
    'zh-TW': '只支援 PDF 檔案。',
    id:      'Cuma file PDF yang didukung ya!',
    jv:      'Mung file PDF sing didukung.',
  },
  'If nothing is detected, double-check that the file is a SongSelect-style chord chart PDF, not a scanned image.': {
    la:      'Si nihil detectum est, verifica documentum esse PDF chordarum generis SongSelect, non imaginem depictam. Machina non oculis videt!',
    'zh-TW': '如果什麼都沒解析到，請確認這是 SongSelect 格式的和弦圖 PDF，不能是掃描圖片喔！程式讀文字，不讀像素！',
    id:      'Kalau gak ke-detect, pastiin filenya PDF chord SongSelect beneran, bukan foto/scan ya bestie! App ini baca teks, bukan gambar!',
    jv:      'Yen ora ketemu apa-apa, pastikna file-e iku PDF chord SongSelect beneran, dudu gambar sing discan, nak. App iki maca teks, ora gambar.',
  },

  // ── §2 Your song set ──
  'Once a PDF is loaded (or you start from scratch), every song appears in the': {
    la:      'Postquam PDF oneratum est (vel ab initio incipis), omnis cantus apparet in',
    'zh-TW': '載入 PDF（或從頭開始）後，每首歌都會出現在',
    id:      'Setelah PDF dimuat (atau mulai dari nol), semua lagu muncul di daftar',
    jv:      'Sawise PDF dimuat (utawa miwiti saka nol), saben lagu katon ing dhaftar',
  },
  'list on the left (on mobile, a horizontal scrollable tab bar at the top).': {
    la:      'lista ad sinistram (in telephono, taenia horizontalis volubilis in summo).',
    'zh-TW': '（左側清單）（手機版則是頂部水平可捲動標籤列）。',
    id:      'di kiri (di HP, ada tab bar horizontal di atas).',
    jv:      'ing sisih kiwa (ing HP, ana tab bar horizontal ing ndhuwur).',
  },
  'Click any song in the list to switch the editor to that song.': {
    la:      'Clicca quemvis cantum in lista ut editorem ad illum commutes.',
    'zh-TW': '點擊列表中的任一首歌，即可切換到該歌曲的編輯器。',
    id:      'Klik lagu apa aja di daftar buat pindah ke editor lagu itu, gampang kan?',
    jv:      'Klik lagu apa wae ing dhaftar, mengko langsung pindhah menyang editor lagu kuwi, gampang ta?',
  },
  'The current key for each song is shown next to its title.': {
    la:      'Clavis actualis cuiusque cantus proxima titulo demonstratur.',
    'zh-TW': '每首歌的目前調性會顯示在標題旁邊。',
    id:      'Kunci saat ini untuk setiap lagu ditampilkan di samping judulnya.',
    jv:      'Kunci saiki saben lagu ditampilake ing jejere judule.',
  },
  'Rename a song title': {
    la:      'Renominare Titulum Cantus',
    'zh-TW': '重新命名歌曲標題',
    id:      'Ganti Nama Judul Lagu',
    jv:      'Ngganti Jeneng Judul Lagu',
  },
  'click the song title in the editor toolbar (above the BPM chip) to edit it inline. Press': {
    la:      'premes in titulo cantus in barra instrumentorum (supra pagellam BPM) ut in situ edas. Premes',
    'zh-TW': '點擊工具列中的歌曲標題（BPM 標籤上方）即可就地編輯。按',
    id:      'klik judul lagu di toolbar editor (di atas chip BPM) untuk edit langsung. Tekan',
    jv:      'klik judul lagu ing toolbar editor (ndhuwur chip BPM) kanggo ngedit langsung. Pencet',
  },
  'to save or': {
    la:      'ut serves vel',
    'zh-TW': '儲存，或按',
    id:      'untuk simpan, atau',
    jv:      'kanggo nyimpen utawa',
  },
  'to cancel. This is especially useful for songs added as blank "New Song" entries.': {
    la:      'ut cancelles. Hoc maxime utile est pro cantibus additis ut ingressus vacuus "Cantus Novus". Inscribe nomen dignum!',
    'zh-TW': '取消。對於以空白「新歌曲」方式新增的歌曲特別有用——記得給它一個名字！',
    id:      'untuk batal. Berguna banget untuk lagu yang ditambah sebagai entri "Lagu Baru" kosong!',
    jv:      'kanggo batal. Iki migunani banget kanggo lagu sing ditambah minangka "Lagu Anyar" kosong, nak.',
  },
  'Remove a song': {
    la:      'Removere Cantum',
    'zh-TW': '移除歌曲',
    id:      'Hapus Lagu',
    jv:      'Mbusak Lagu',
  },
  'hover over a song in the list and click the': {
    la:      'sustine super cantum in lista et premes',
    'zh-TW': '將滑鼠懸停在列表中的歌曲上，點擊',
    id:      'arahkan kursor ke lagu di daftar, lalu klik',
    jv:      'arahke kursor menyang lagu ing dhaftar, banjur klik',
  },
  'button that appears on the right. Removing the last song returns you to the upload screen.': {
    la:      'papilionem qui apparet ad dextram. Remotio ultimi cantus te ad paginam importationis reducit.',
    'zh-TW': '右側出現的按鈕。移除最後一首歌會返回上傳畫面。',
    id:      'yang muncul di kanan. Hapus lagu terakhir bakal balik ke layar upload.',
    jv:      'tombol sing katon ing tengen. Mbusak lagu pungkasan bakal bali menyang layar upload.',
  },
  'Collapse the sidebar': {
    la:      'Contrahere Barra Lateralis',
    'zh-TW': '收合側邊欄',
    id:      'Ciutkan Sidebar',
    jv:      'Ciutake Sidebar',
  },
  'on desktop and tablet, click the': {
    la:      'in computatro et tabella, premes',
    'zh-TW': '在電腦或平板上，點擊',
    id:      'di desktop/tablet, klik',
    jv:      'ing komputer lan tablet, klik',
  },
  'button in the sidebar header to collapse it to a narrow strip, giving more room to the editor. Click': {
    la:      'papilionem in capite barra lateralis ut eum in fasciam angustam contrahas, plus spatii editoriis dans. Premes',
    'zh-TW': '側邊欄標題中的按鈕，將其收合為窄條，給編輯器更多空間。點擊',
    id:      'di header sidebar untuk ciutkannya jadi strip tipis, biar editor makin lega. Klik',
    jv:      'ing header sidebar kanggo nyempitake dadi strip tipis, menehi ruang luwih kanggo editor. Klik',
  },
  'to expand it again. On mobile, tap': {
    la:      'ut iterum expandas. In telephono, tange',
    'zh-TW': '再次展開。在手機上，點按',
    id:      'untuk buka lagi. Di HP, tap',
    jv:      'kanggo mbukak maneh. Ing HP, tap',
  },
  'to collapse the song bar and free up vertical space; tap again (': {
    la:      'ut tabulam cantuum contrahas et spatium verticale liberes; tange iterum (',
    'zh-TW': '收合歌曲列以釋放垂直空間；再次點按（',
    id:      'untuk ciutkan bar lagu biar ada ruang lebih; tap lagi (',
    jv:      'kanggo nyimpet bar lagu lan mbebasake ruang vertikal; tap maneh (',
  },
  ') to expand it.': {
    la:      ') ut expandas.',
    'zh-TW': '）再次展開。',
    id:      ') untuk buka lagi.',
    jv:      ') kanggo mbukak maneh.',
  },
  'Adding songs to an existing set': {
    la:      'Addere Cantus ad Collectionem Existentem',
    'zh-TW': '在現有集合中新增歌曲',
    id:      'Tambah Lagu ke Set yang Ada',
    jv:      'Nambahake Lagu menyang Set sing Wis Ana',
  },
  'On desktop and tablet,': {
    la:      'In computatro et tabella,',
    'zh-TW': '在電腦與平板上，',
    id:      'Di desktop dan tablet,',
    jv:      'Ing komputer lan tablet,',
  },
  'and': {
    la:      'et',
    'zh-TW': '和',
    id:      'dan',
    jv:      'lan',
  },
  'appear directly at the end of the song list (below the last song). On mobile, tap the': {
    la:      'apparent directe in fine listae cantuum (post ultimum cantum). In telephono, tange',
    'zh-TW': '直接出現在歌曲列表末尾（最後一首歌下方）。在手機上，點按',
    id:      'muncul langsung di akhir daftar lagu (setelah lagu terakhir). Di HP, tap',
    jv:      'katon langsung ing pungkasane dhaftar lagu (sawise lagu pungkasan). Ing HP, tap',
  },
  'button at the end of the tab strip to reveal them:': {
    la:      'papilionem in fine taeniae tabellarum ut eos reveles:',
    'zh-TW': '標籤列末尾的按鈕來顯示它們：',
    id:      'di ujung tab strip untuk munculkan mereka:',
    jv:      'tombol ing pungkasane tab strip kanggo namoake:',
  },
  'adds a blank song to the bottom of the list. Give it a name, add sections, and build it from scratch.': {
    la:      'addit cantum vacuum in fundo listae. Da ei nomen dignum, adde sectiones, et aedifica ex nihilo!',
    'zh-TW': '在列表底部新增一首空白歌曲。給它一個名字、加入段落，從頭打造！',
    id:      'tambah lagu kosong di bawah daftar. Kasih nama, tambah bagian, dan build dari nol!',
    jv:      'nambahake lagu kosong ing pungkasane dhaftar. Wenehana jeneng, tambah bagian, lan bangun saka nol.',
  },
  'appends songs from another PDF': {
    la:      'appendit cantus e alio PDF',
    'zh-TW': '從另一個 PDF 附加歌曲',
    id:      'menambahkan lagu dari PDF lain',
    jv:      'nambahake lagu saka PDF liya',
  },
  'without': {
    la:      'sine',
    'zh-TW': '，而不',
    id:      'tanpa',
    jv:      'tanpa',
  },
  'replacing what\'s already in your set. Great for building a multi-song set from separate files.': {
    la:      'reponendo quae iam in collectione tua sunt. Optimum pro construendo collectione multorum cantuum ex fasciculis separatis!',
    'zh-TW': '替換已有的歌曲。非常適合從多個獨立檔案建立多曲集！',
    id:      'mengganti yang sudah ada di set kamu. Cocok banget buat bikin set multi-lagu dari file terpisah!',
    jv:      'ngganti sing wis ana ing set-mu. Cocok banget kanggo nggawe set multi-lagu saka file terpisah.',
  },
  'If any imported song title already exists in the set, a warning appears. You can choose to': {
    la:      'Si titulus cuiusvis cantus importati iam in collectione exstat, monitio apparet. Eligere potes',
    'zh-TW': '如果匯入的歌曲標題已存在於集合中，會出現警告。你可以選擇',
    id:      'Kalau ada judul lagu yang sudah ada di set, bakal ada peringatan. Kamu bisa pilih',
    jv:      'Yen ana judul lagu sing wis ana ing set, ana peringatan. Kowe iso milih',
  },
  '(add all including duplicates) or': {
    la:      '(adde omnes cum similibus) vel',
    'zh-TW': '（新增全部包含重複）或',
    id:      '(tambah semua termasuk duplikat) atau',
    jv:      '(tambah kabeh kalebu duplikat) utawa',
  },
  '(only import songs with new titles).': {
    la:      '(importa solum cantus cum titulis novis).',
    'zh-TW': '（只匯入新標題的歌曲）。',
    id:      '(hanya impor lagu dengan judul baru).',
    jv:      '(mung impor lagu kanthi judul anyar).',
  },
  'Reordering songs': {
    la:      'Cantus Reordinare',
    'zh-TW': '重新排序歌曲',
    id:      'Mengubah Urutan Lagu',
    jv:      'Ngurutake Maneh Lagu',
  },
  'Drag the': {
    la:      'Trahere',
    'zh-TW': '拖動',
    id:      'Seret',
    jv:      'Seret',
  },
  'handle on any song row up or down to reorder the list. This also works on touch screens — press and hold the handle, then drag.': {
    la:      'sigillum in quavis serie cantus sursum vel deorsum ut listam reordines. Hoc etiam in schermatibus tactu laborat — premes et tene, tum trahe!',
    'zh-TW': '任何歌曲列上的把手上下拖動，重新排序列表。觸控螢幕也可以——長按把手後再拖。',
    id:      'handle di baris lagu mana aja ke atas/bawah untuk ubah urutan. Ini juga bisa di layar sentuh — tekan tahan handlenya, terus seret!',
    jv:      'handle ing baris lagu apa wae munggah utawa mudhun kanggo ngurut maneh dhaftar. Iki uga iso ing layar sentuh — pencet lan tahan handle-e, banjur seret.',
  },
  'Reordering is undoable with': {
    la:      'Reordinatio rescindi potest cum',
    'zh-TW': '重新排序可以用',
    id:      'Urutan ulang bisa dibatalkan dengan',
    jv:      'Ngurutake maneh iso dibatalake nganggo',
  },
  '.': {
    la:      '.',
    'zh-TW': '。',
    id:      '.',
    jv:      '.',
  },

  // ── §3 Editing chords & lyrics ──
  'The editor mirrors the printed layout: chords float above the lyric line they belong to.': {
    la:      'Editor dispositionem impressam speculi instar ostendit: chordae supra lineam verborum ad quam pertinent volant.',
    'zh-TW': '編輯器模仿印刷排版：和弦浮在對應的歌詞行上方。',
    id:      'Editor mencerminkan tata letak cetak: akor mengambang di atas baris lirik yang sesuai.',
    jv:      'Editor niru tata letak cetak: akor ngambang ing ndhuwur baris lirik sing cocog.',
  },
  'Chords': {
    la:      'Chordae',
    'zh-TW': '和弦',
    id:      'Akor',
    jv:      'Akor',
  },
  'Rename a chord': {
    la:      'Renominare Chordam',
    'zh-TW': '重新命名和弦',
    id:      'Ganti Nama Akor',
    jv:      'Ngganti Jeneng Akor',
  },
  'click it, type the new chord, then press': {
    la:      'premes, inscribe chordam novam, deinde premes',
    'zh-TW': '點擊它，輸入新和弦，然後按',
    id:      'klik, ketik akor baru, lalu tekan',
    jv:      'klik, ketik akor anyar, banjur pencet',
  },
  '(or click elsewhere) to save. Press': {
    la:      '(vel alibi premes) ut serves. Premes',
    'zh-TW': '（或點擊其他地方）儲存。按',
    id:      '(atau klik di tempat lain) untuk simpan. Tekan',
    jv:      '(utawa klik neng ngendi wae) kanggo nyimpen. Pencet',
  },
  'to cancel.': {
    la:      'ut cancelles.',
    'zh-TW': '取消。',
    id:      'untuk batal.',
    jv:      'kanggo batal.',
  },
  'Reposition a chord': {
    la:      'Reponere Chordam',
    'zh-TW': '調整和弦位置',
    id:      'Pindahkan Posisi Akor',
    jv:      'Nggeser Posisi Akor',
  },
  'click and drag it left or right to line it up exactly where it falls in the lyric.': {
    la:      'premes et trahe sinistrorsum vel dextrorsum ut eum colloces exacte ubi in verbis cadit.',
    'zh-TW': '點擊並左右拖動，將其精確對準歌詞中的位置。',
    id:      'klik terus seret ke kiri-kanan sampai pas banget di posisi liriknya, no asal-asalan!',
    jv:      'klik banjur seret mengiwa utawa mengetan, nganti pas persis ing lirike, ora usah kesusu.',
  },
  'Add a chord': {
    la:      'Addere Chordam',
    'zh-TW': '新增和弦',
    id:      'Tambah Akor',
    jv:      'Nambah Akor',
  },
  'use the': {
    la:      'adhibere',
    'zh-TW': '使用',
    id:      'gunakan',
    jv:      'nggunakake',
  },
  'button in the left gutter of a line, or click': {
    la:      'papilionem in margine sinistro lineae, vel premes',
    'zh-TW': '行左側的按鈕，或點擊',
    id:      'tombol di gutter kiri baris, atau klik',
    jv:      'tombol ing sisih kiwa baris, utawa klik',
  },
  'on an empty line. New chords start as': {
    la:      'in linea vacua. Chordae novae incipiunt ut',
    'zh-TW': '在空白行上。新和弦預設為',
    id:      'di baris kosong. Akor baru dimulai sebagai',
    jv:      'ing baris kosong. Akor anyar diwiwiti minangka',
  },
  'and open for editing immediately.': {
    la:      'et statim ad edendum aperiuntur.',
    'zh-TW': '，並立即開啟編輯模式。',
    id:      'dan langsung terbuka untuk diedit.',
    jv:      'lan langsung mbukak kanggo diedit.',
  },
  'Remove a chord': {
    la:      'Removere Chordam',
    'zh-TW': '移除和弦',
    id:      'Hapus Akor',
    jv:      'Mbusak Akor',
  },
  'hover over it and click the small': {
    la:      'sustine super eam et premes parvum',
    'zh-TW': '將滑鼠懸停在上面，點擊小小的',
    id:      'arahkan kursor ke sana dan klik tombol kecil',
    jv:      'arahke kursor menyang kono lan klik tombol cilik',
  },
  'that appears.': {
    la:      'quod apparet.',
    'zh-TW': '按鈕即可。',
    id:      'yang muncul.',
    jv:      'sing katon.',
  },
  'Lyrics & lines': {
    la:      'Verba & Lineae',
    'zh-TW': '歌詞與行',
    id:      'Lirik & Baris',
    jv:      'Lirik & Baris',
  },
  'Click directly into any lyric line to edit the text in place.': {
    la:      'Clicca directe in quamvis lineam verborum ut textum in situ edas.',
    'zh-TW': '直接點擊任何歌詞行即可就地編輯文字。',
    id:      'Klik langsung ke baris lirik mana saja untuk edit teksnya di tempat.',
    jv:      'Klik langsung menyang baris lirik apa wae kanggo ngedit teks ing kono.',
  },
  'Add a new line under a section with the': {
    la:      'Adde lineam novam sub sectione cum',
    'zh-TW': '使用',
    id:      'Tambah baris baru di bawah bagian dengan',
    jv:      'Tambah baris anyar ing ngisor bagian nganggo',
  },
  'button in that section\'s header.': {
    la:      'papilione in capite illius sectionis.',
    'zh-TW': '按鈕在該段落的標題中新增行。',
    id:      'di header bagian tersebut.',
    jv:      'ing header bagian kasebut.',
  },
  'Remove a line using the': {
    la:      'Remove lineam cum',
    'zh-TW': '使用',
    id:      'Hapus baris menggunakan',
    jv:      'Mbusak baris nganggo',
  },
  'button in its left gutter. A section always keeps at least one line.': {
    la:      'papilione in margine sinistro eius. Sectio semper servat saltem unam lineam.',
    'zh-TW': '左側的按鈕移除行。每個段落至少保留一行。',
    id:      'tombol di gutter kirinya. Setiap bagian selalu punya minimal satu baris.',
    jv:      'tombol ing sisih kiwa. Saben bagian tansah njaga minimal siji baris.',
  },
  'Tempo & time signature': {
    la:      'Tempus & Modus Temporis',
    'zh-TW': '速度與拍號',
    id:      'Tempo & Tanda Birama',
    jv:      'Tempo & Tanda Birama',
  },
  'Edit tempo': {
    la:      'Emendare Tempus',
    'zh-TW': '編輯速度',
    id:      'Edit Tempo',
    jv:      'Edit Tempo',
  },
  'chip in the toolbar, type a new number, then press': {
    la:      'pagellam in barra instrumentorum, inscribe numerum novum, deinde premes',
    'zh-TW': '工具列中的標籤，輸入新數字，然後按',
    id:      'chip di toolbar, ketik angka baru, lalu tekan',
    jv:      'chip ing toolbar, ketik angka anyar, banjur pencet',
  },
  '(or click elsewhere) to save. Clearing it shows a': {
    la:      '(vel alibi premes) ut serves. Si deles, apparet',
    'zh-TW': '（或點擊其他地方）儲存。清除後會顯示',
    id:      '(atau klik di tempat lain) untuk simpan. Menghapusnya akan menampilkan',
    jv:      '(utawa klik neng ngendi wae) kanggo nyimpen. Yen dihapus, katon',
  },
  'placeholder you can click to set a new value. Press': {
    la:      'indicem qui premi potest ad valorem novum ponendum. Premes',
    'zh-TW': '佔位符，點擊可設定新值。按',
    id:      'placeholder yang bisa diklik untuk set nilai baru. Tekan',
    jv:      'placeholder sing iso diklik kanggo nyetel nilai anyar. Pencet',
  },
  'Edit time signature': {
    la:      'Emendare Modum Temporis',
    'zh-TW': '編輯拍號',
    id:      'Edit Tanda Birama',
    jv:      'Edit Tanda Birama',
  },
  'click the time signature chip (e.g.': {
    la:      'premes pagellam modi temporis (e.g.',
    'zh-TW': '點擊拍號標籤（例如',
    id:      'klik chip tanda birama (mis.',
    jv:      'klik chip tanda birama (tuladha',
  },
  'next to the BPM chip, type a new signature such as': {
    la:      'proxima pagellae BPM, inscribe signaturam novam ut',
    'zh-TW': '）在 BPM 標籤旁，輸入新的拍號如',
    id:      ') di samping chip BPM, ketik tanda birama baru seperti',
    jv:      ') ing jejere chip BPM, ketik tanda birama anyar kaya',
  },
  ', then press': {
    la:      ', deinde premes',
    'zh-TW': '，然後按',
    id:      ', lalu tekan',
    jv:      ', banjur pencet',
  },
  'to save. An invalid entry reverts to the previous value. Press': {
    la:      'ut serves. Inscriptio invalida ad valorem priorem revertitur. Premes',
    'zh-TW': '儲存。無效的輸入會還原為先前的值。按',
    id:      'untuk simpan. Tanda birama yang tidak valid akan kembali ke nilai sebelumnya. Tekan',
    jv:      'kanggo nyimpen. Input sing ora valid bakal bali menyang nilai sadurunge. Pencet',
  },
  'Annotations': {
    la:      'Annotationes',
    'zh-TW': '標記',
    id:      'Anotasi',
    jv:      'Anotasi',
  },
  'Add a note': {
    la:      'Addere Notam',
    'zh-TW': '新增標記',
    id:      'Tambah Catatan',
    jv:      'Nambah Cathetan',
  },
  'on a lyric line with no annotation, hover it and click': {
    la:      'in linea verborum sine annotatione, sustine super eam et premes',
    'zh-TW': '在沒有標記的歌詞行上，懸停並點擊',
    id:      'pada baris lirik tanpa anotasi, arahkan kursor dan klik',
    jv:      'ing baris lirik tanpa anotasi, arahke kursor lan klik',
  },
  ', type a direction note or bar notation (e.g.': {
    la:      ', inscribe notam directionis vel notationem barrarum (e.g.',
    'zh-TW': '，輸入方向標記或小節符號（例如',
    id:      ', ketik catatan arah atau notasi bar (mis.',
    jv:      ', ketik cathetan arah utawa notasi bar (tuladha',
  },
  '), then press': {
    la:      '), deinde premes',
    'zh-TW': '），然後按',
    id:      '), lalu tekan',
    jv:      '), banjur pencet',
  },
  'to save.': {
    la:      'ut serves.',
    'zh-TW': '儲存。',
    id:      'untuk simpan.',
    jv:      'kanggo nyimpen.',
  },
  'Edit a note': {
    la:      'Emendare Notam',
    'zh-TW': '編輯標記',
    id:      'Edit Catatan',
    jv:      'Edit Cathetan',
  },
  'click an existing annotation to edit it in place.': {
    la:      'premes annotationem existentem ut eam in situ edas.',
    'zh-TW': '點擊現有標記即可就地編輯。',
    id:      'klik anotasi yang ada untuk edit langsung di tempat.',
    jv:      'klik anotasi sing wis ana kanggo ngedit ing kono.',
  },
  'Remove a note': {
    la:      'Removere Notam',
    'zh-TW': '移除標記',
    id:      'Hapus Catatan',
    jv:      'Mbusak Cathetan',
  },
  'while editing, click the': {
    la:      'dum edis, premes',
    'zh-TW': '編輯時，點擊',
    id:      'saat mengedit, klik',
    jv:      'nalika ngedit, klik',
  },
  'next to the annotation input.': {
    la:      'proxima campo annotationis.',
    'zh-TW': '標記輸入欄旁的按鈕。',
    id:      'di samping input anotasi.',
    jv:      'ing jejere input anotasi.',
  },
  'Annotations are stored untransposed and transposed only for display, so bar notation like': {
    la:      'Annotationes sine transpositione servantur et solum ad ostendendum transponuntur, ita notatio barrarum ut',
    'zh-TW': '標記以原始調性儲存，僅在顯示時移調，所以小節符號如',
    id:      'Anotasi disimpan tanpa transpose dan hanya di-transpose untuk tampilan, jadi notasi bar seperti',
    jv:      'Anotasi disimpen tanpa transpose lan mung ditranspose kanggo tampilan, dadi notasi bar kaya',
  },
  'stays correct no matter how many times you transpose the song.': {
    la:      'semper recta manet quotcumque vicibus cantum transponis.',
    'zh-TW': '不管你移調幾次都會保持正確。',
    id:      'tetap benar berapa kali pun kamu transpose lagunya.',
    jv:      'tetep bener sak pirang-pirange kowe transpose lagune, nak.',
  },

  // ── §4 Working with sections ──
  'Add a section': {
    la:      'Addere Sectionem',
    'zh-TW': '新增段落',
    id:      'Tambah Bagian',
    jv:      'Nambah Bagian',
  },
  'below the song, use the quick-pick buttons (INTRO, VERSE, CHORUS, PRE-CHORUS, BRIDGE, OUTRO, TAG) or type a custom name and click': {
    la:      'sub cantu, adhibere papiliones veloces (INTRO, VERSUS, CHORUS, PRE-CHORUS, PONS, OUTRO, TAG) vel inscribere nomen proprium et premere',
    'zh-TW': '在歌曲下方，使用快速選取按鈕（INTRO、VERSE、CHORUS、PRE-CHORUS、BRIDGE、OUTRO、TAG），或輸入自訂名稱並點擊',
    id:      'di bawah lagu, pakai tombol cepat (INTRO, VERSE, CHORUS, PRE-CHORUS, BRIDGE, OUTRO, TAG) atau ketik nama khusus dan klik',
    jv:      'ing ngisor lagu, nggunakake tombol cepet (INTRO, VERSE, CHORUS, PRE-CHORUS, BRIDGE, OUTRO, TAG) utawa ketik jeneng dhewe lan klik',
  },
  '/ press': {
    la:      '/ premes',
    'zh-TW': '/ 按',
    id:      '/ tekan',
    jv:      '/ pencet',
  },
  'Reorder sections': {
    la:      'Sectiones Reordinare',
    'zh-TW': '重新排序段落',
    id:      'Ubah Urutan Bagian',
    jv:      'Ngurutake Maneh Bagian',
  },
  'drag handle in a section\'s header and drop it where you want it.': {
    la:      'sigillum trahendi in capite sectionis et depone ubi vis.',
    'zh-TW': '段落標題中的拖動把手，放到你想要的位置。',
    id:      'drag handle di header bagian dan taruh di tempat yang kamu mau.',
    jv:      'drag handle ing header bagian lan seleh ing panggonan sing kok karepake.',
  },
  'grab the': {
    la:      'cape',
    'zh-TW': '抓住',
    id:      'pegang',
    jv:      'cekel',
  },
  'Remove a section': {
    la:      'Removere Sectionem',
    'zh-TW': '移除段落',
    id:      'Hapus Bagian',
    jv:      'Mbusak Bagian',
  },
  'click the': {
    la:      'premes',
    'zh-TW': '點擊',
    id:      'klik',
    jv:      'klik',
  },
  'button in the section header.': {
    la:      'papilionem in capite sectionis.',
    'zh-TW': '段落標題中的按鈕。',
    id:      'tombol di header bagian.',
    jv:      'tombol ing header bagian.',
  },

  // ── §5 Keys & transposition ──
  'Step transpose': {
    la:      'Transpositio Gradatim',
    'zh-TW': '半音移調',
    id:      'Transpose Bertahap',
    jv:      'Transpose Setengah Nada',
  },
  'buttons next to the key display to move the whole song up or down one semitone at a time. Every chord on the page updates instantly.': {
    la:      'papiliones iuxta ostentationem clavis ut totum cantum sursum vel deorsum per semitonum moveant. Omnis chorda in pagina statim renovatur. Mirabile!',
    'zh-TW': '調性顯示旁的按鈕，每次上移或下移整首歌一個半音。頁面上所有和弦即時更新！',
    id:      'tombol di samping tampilan kunci untuk naik/turun satu semitone sekaligus. Semua akor di halaman auto-update, secepat kilat!',
    jv:      'tombol ing jejere tampilan kunci kanggo munggah utawa mudhun siji semitone. Kabeh akor ing kaca langsung dianyari, cepet kaya kilat, nak.',
  },
  'Jump to a key': {
    la:      'Saltire ad Clavem',
    'zh-TW': '跳至調性',
    id:      'Langsung ke Kunci',
    jv:      'Loncat menyang Kunci',
  },
  'pick any key directly from the': {
    la:      'eligere quamlibet clavem directe e',
    'zh-TW': '直接從',
    id:      'pilih kunci langsung dari',
    jv:      'pilih kunci langsung saka',
  },
  'dropdown. The list uses your current Accidentals preference (see §10).': {
    la:      'menu cadente. Lista adhibet praeferentiam Accidentalium tuam currentem (vide §10).',
    'zh-TW': '下拉選單直接選任何調性。列表使用你目前的升降記號偏好（見第 10 節）。',
    id:      'dropdown. Daftarnya pakai preferensi Akidental kamu saat ini (lihat §10).',
    jv:      'dropdown. Dhaftare nggunakake preferensi Akidental-mu saiki (delok §10).',
  },
  'once you\'ve transposed, a': {
    la:      'postquam transposuisti,',
    'zh-TW': '移調後，',
    id:      'setelah transpose,',
    jv:      'sawise transpose,',
  },
  'button appears showing the original key; click it to snap straight back.': {
    la:      'papilio apparet ostendens clavem originalem; premes eum ut statim revertaris.',
    'zh-TW': '按鈕出現並顯示原始調性；點擊即可立即還原。',
    id:      'tombol muncul menampilkan kunci asli; klik untuk langsung balik ke semula.',
    jv:      'tombol katon nampilake kunci asli; klik kanggo langsung bali.',
  },
  'Whenever the song is transposed, a banner above the chart confirms the change, e.g.': {
    la:      'Quotienscumque cantus transponitur, taenia supra tabulam mutationem confirmat, e.g.',
    'zh-TW': '每次移調時，和弦圖上方的橫幅會確認變更，例如',
    id:      'Setiap kali lagu ditranspose, banner di atas chart mengonfirmasi perubahannya, mis.',
    jv:      'Saben kali lagu ditranspose, banner ing ndhuwur chart ngonfirmasi owahane, tuladha',
  },
  'Transposed from G → A (+2 semitones)': {
    la:      'Transpositum e G → A (+2 semitoni)',
    'zh-TW': '從 G 移調至 A（+2 個半音）',
    id:      'Ditranspose dari G → A (+2 semitone)',
    jv:      'Ditranspose saka G → A (+2 semitone)',
  },

  // ── §6 Bass notes & Nashville numbers ──
  'toggles every chord down to just its root/bass note (e.g.': {
    la:      'omnes chordas ad solam notam radicem/bassi commutat (e.g.',
    'zh-TW': '將每個和弦切換為僅顯示根音/低音（例如',
    id:      'toggle setiap akor ke not bass/root-nya saja (mis.',
    jv:      'ngowahi saben akor dadi mung not bass/root-ne wae (tuladha',
  },
  '). Handy for simplified or beginner charts.': {
    la:      '). Utile pro tabulis simplicioribus vel pro initiis. Optima!',
    'zh-TW': '）。非常適合簡化版或初學者使用！',
    id:      '). Cocok banget untuk chart yang disederhanakan atau pemula, dijamin gak pusing!',
    jv:      '). Migunani banget kanggo chart sing disederhanakake utawa kanggo pemula, ora usah bingung.',
  },
  'converts every chord to a scale-degree number (1–7, with ♭/♯ prefixes for accidentals), relative to the song\'s current key. Useful for ear-trained players and key-independent charts.': {
    la:      'omnes chordas ad numerum gradus scalae (1–7, cum praefixis ♭/♯ pro accidentalibus), relative ad clavem cantus currentem, convertit. Utile pro musicis auribus exercitatis et tabulis a clave independentibus.',
    'zh-TW': '將每個和弦轉換為音階度數數字（1–7，升降記號加前綴），相對於歌曲目前調性。對受過音感訓練的演奏者和不依賴調性的樂譜非常有用！',
    id:      'mengubah setiap akor ke nomor skala (1–7, dengan awalan ♭/♯), relatif ke kunci lagu saat ini. Berguna untuk pemain yang terlatih telinga dan chart yang bebas kunci!',
    jv:      'ngowahi saben akor dadi nomor skala (1–7, kanthi awalan ♭/♯), relatif marang kunci lagu saiki. Migunani kanggo pemain sing wis terlatih kuping lan chart sing bebas kunci.',
  },
  'Both toggles can be combined with transposition, and both are respected by every export.': {
    la:      'Ambo commutamina cum transpositione combinari possunt, et ambo in omni exportatione respiciuntur.',
    'zh-TW': '這兩個切換可以與移調結合使用，且所有匯出都會遵循這些設定。',
    id:      'Kedua toggle bisa dikombinasikan dengan transposisi, dan keduanya berlaku di semua ekspor.',
    jv:      'Loro-lorone toggle iso digabungake karo transposisi, lan loro-lorone dihormati ing saben ekspor.',
  },

  // ── §7 Undo & redo ──
  'Every edit — chord changes, lyric edits, section moves, additions and removals — can be undone.': {
    la:      'Omnis emendatio — mutationes chordarum, emendationes verborum, motus sectionum, additiones et remota — rescindi potest. Noli timere errare!',
    'zh-TW': '每個編輯——和弦更改、歌詞編輯、段落移動、新增和刪除——都可以撤銷。大膽做，後悔了就按撤銷！',
    id:      'Setiap edit — perubahan akor, edit lirik, pindah bagian, tambah dan hapus — bisa dibatalkan. Gak perlu takut salah!',
    jv:      'Saben edit — owahane akor, ngedit lirik, mindah bagian, nambah lan mbusak — iso dibatalake. Ora usah wedi salah, nak!',
  },
  'Use the': {
    la:      'Adhibere',
    'zh-TW': '使用',
    id:      'Gunakan',
    jv:      'Nggunakake',
  },
  'buttons in the toolbar.': {
    la:      'papiliones in barra instrumentorum.',
    'zh-TW': '工具列中的按鈕。',
    id:      'tombol di toolbar.',
    jv:      'tombol ing toolbar.',
  },
  'Or use the keyboard:': {
    la:      'Vel adhibere claviarium:',
    'zh-TW': '或使用鍵盤：',
    id:      'Atau pakai keyboard:',
    jv:      'Utawa nggunakake keyboard:',
  },
  'to undo,': {
    la:      'ut rescindas,',
    'zh-TW': '撤銷，',
    id:      'untuk batalkan,',
    jv:      'kanggo mbatalake,',
  },
  'to redo.': {
    la:      'ut refacias.',
    'zh-TW': '取消撤銷。',
    id:      'untuk ulangi.',
    jv:      'kanggo mbaleni.',
  },
  'History holds up to 50 steps per editing session, and is cleared whenever you load a new PDF.': {
    la:      'Historia tenet usque ad 50 gradus per sessionem editionis, et expungitur quotienscumque novum PDF oneras.',
    'zh-TW': '歷史記錄最多保留每次編輯工作階段的 50 個步驟，每次載入新 PDF 時會清除。',
    id:      'Riwayat menyimpan hingga 50 langkah per sesi editing, dan dihapus setiap kali kamu load PDF baru.',
    jv:      'Riwayat nyimpen nganti 50 langkah saben sesi ngedit, lan dihapus saben kowe muat PDF anyar.',
  },

  // ── §8 Exporting & sharing ──
  'Click the': {
    la:      'Premes',
    'zh-TW': '點擊',
    id:      'Klik',
    jv:      'Klik',
  },
  'button in the app header to open the export panel. Three options are available:': {
    la:      'papilionem in capite applicationis ut tabulam exportationis aperias. Tres optiones adsunt:',
    'zh-TW': 'App 標題中的按鈕開啟匯出面板。有三個選項：',
    id:      'di header app untuk buka panel ekspor. Ada tiga pilihan:',
    jv:      'ing header app kanggo mbukak panel ekspor. Ana telu pilihan:',
  },
  'exports just the song you\'re currently editing as a clean, monospace chord chart PDF. At the default 14 px PDF font size the layout is two-column; larger sizes switch to single-column automatically.': {
    la:      'exportat solum cantum quem nunc edis ut PDF chordarum purum, monospace. In magnitudine PDF 14 px defalta, dispositio est bicolumnis; magnitudines maiores ad unam columnam automatice commutantur.',
    'zh-TW': '將你目前編輯的歌曲匯出為乾淨的等寬字體和弦圖 PDF。預設 14px PDF 字型大小時為雙欄版面，更大尺寸自動切換為單欄。',
    id:      'ekspor lagu yang sedang kamu edit sebagai PDF chord chart yang bersih, monospace. Di ukuran font PDF default 14px layoutnya dua kolom; ukuran lebih besar otomatis beralih ke satu kolom.',
    jv:      'ngekspor mung lagu sing lagi kok edit minangka PDF chord chart sing resik, monospace. Ing ukuran font PDF default 14px, layoute rong kolom; ukuran luwih gedhe otomatis dadi siji kolom.',
  },
  'exports every song in the set into a single PDF, in list order, one song per page.': {
    la:      'exportat omnes cantus in collectione in unum PDF, in ordine listae, unum cantum per paginam.',
    'zh-TW': '將集合中的每首歌以列表順序匯出為單一 PDF，每頁一首歌。',
    id:      'ekspor semua lagu di set ke satu PDF, urut sesuai daftar, satu lagu per halaman.',
    jv:      'ngekspor kabeh lagu ing set dadi siji PDF, urut kaya dhaftar, siji lagu saben kaca.',
  },
  'exports the full set as a': {
    la:      'exportat collectionem completam ut',
    'zh-TW': '將整個集合匯出為',
    id:      'ekspor set lengkap sebagai file',
    jv:      'ngekspor set lengkap minangka file',
  },
  'file, with chord rows placed above each lyric line, viewable in any Markdown reader.': {
    la:      'fasciculum, cum seriebus chordarum supra quamlibet lineam verborum positis, in quolibet lectore Markdown videndum.',
    'zh-TW': '檔案，和弦行放在每行歌詞上方，可在任何 Markdown 閱讀器中查看。',
    id:      'dengan baris chord di atas setiap baris lirik, bisa dibuka di semua Markdown reader.',
    jv:      'kanthi baris chord ing ndhuwur saben baris lirik, iso didelok ing Markdown reader apa wae.',
  },
  'All exports respect your current transposition, the Bass Notes toggle, the Nashville toggle, your Accidentals preference, and include any direction/bar-notation annotations, correctly transposed.': {
    la:      'Omnes exportationes transpositionem tuam currentem, commutamen Notarum Bassi, commutamen Nashville, praeferentiam Accidentalium tuam observant, et annotationes directionis/notationis barrarum, recte transpositas, includunt.',
    'zh-TW': '所有匯出都遵循你目前的移調、低音音符切換、Nashville 切換、升降記號偏好，並包含所有方向/小節標記，且已正確移調。',
    id:      'Semua ekspor mengikuti transposisi saat ini, toggle Bass Notes, toggle Nashville, preferensi Akidental, dan termasuk semua anotasi arah/notasi bar yang sudah ditranspose dengan benar.',
    jv:      'Kabeh ekspor ngurmati transposisi saiki, toggle Bass Notes, toggle Nashville, preferensi Akidental, lan kalebu kabeh anotasi arah/notasi bar sing wis ditranspose kanthi bener.',
  },
  'To adjust the': {
    la:      'Ad emendandum',
    'zh-TW': '若要調整',
    id:      'Untuk mengatur',
    jv:      'Kanggo nyetel',
  },
  '(10–20 px, default 14 px), open ⚙️ Settings → Export. Sizes above 14 px switch the PDF to a single-column layout; a warning is shown in Settings when this threshold is exceeded.': {
    la:      '(10–20 px, defalta 14 px), aperi ⚙️ Optiones → Exportationem. Magnitudines supra 14 px PDF ad dispositionem unius columnae commutant; monitio in Optionibus ostenditur cum hic limes superatur.',
    'zh-TW': '（10–20px，預設 14px），請開啟 ⚙️ 設定 → 匯出。超過 14px 的尺寸會將 PDF 切換為單欄版面；超過此閾值時，設定中會顯示警告。',
    id:      '(10–20px, default 14px), buka ⚙️ Pengaturan → Ekspor. Ukuran di atas 14px akan beralih ke layout satu kolom; peringatan ditampilkan di Pengaturan kalau batas ini terlampaui.',
    jv:      '(10–20px, default 14px), bukak ⚙️ Setelan → Ekspor. Ukuran ing ndhuwur 14px ngalih menyang layout siji kolom; peringatan ditampilake ing Setelan yen wates iki dilewati.',
  },
  'Round-trip friendly:': {
    la:      'Amicalis itineri duplici:',
    'zh-TW': '支援重新匯入：',
    id:      'Ramah untuk re-upload:',
    jv:      'Cocok kanggo re-upload:',
  },
  'PDFs exported from WorshipToolkit can be re-uploaded later. The app embeds the exact column layout in the file so your edits, chord positions, and structure come back intact — no need to keep a separate source file.': {
    la:      'PDF exportata ex WorshipToolkit postea onerari possunt. Applicatio dispositionem exactam columnarum in fasciculum inserit, ita emendationes tuae, positiones chordarum, et structura integrae redeunt — non opus est fasciculum fontis separatum servare.',
    'zh-TW': 'WorshipToolkit 匯出的 PDF 之後可以重新上傳。App 會在檔案中嵌入精確的欄位版面，所以你的編輯、和弦位置和結構都會完整保留——不需要保存單獨的來源檔案！',
    id:      'PDF yang diekspor dari WorshipToolkit bisa di-upload lagi nanti. App menyematkan layout kolom persis di filenya, jadi editan, posisi akor, dan struktur kamu balik utuh — gak perlu simpan file sumber terpisah!',
    jv:      'PDF sing diekspor saka WorshipToolkit iso diunggah maneh mengko. App nyematake layout kolom sing persis ing file-e, dadi editanmu, posisi akor, lan struktur bali utuh — ora perlu nyimpen file sumber terpisah, nak.',
  },

  // ── §9 Saved sets & autosave ──
  'A': {
    la:      'Una',
    'zh-TW': '一個',
    id:      'Sebuah',
    jv:      'Siji',
  },
  'set': {
    la:      'collectio',
    'zh-TW': '集合',
    id:      'set',
    jv:      'set',
  },
  'is your current collection of songs. Saving a set lets you snapshot it and return to it later — even if you close the browser or start working on a different set in the meantime.': {
    la:      'est collectio tua actualis cantuum. Servatio collectionis te sinit eam in imagine congelata capere et ad eam postea redire — etiam si navigatrum claudis vel interea aliam collectionem laborans.',
    'zh-TW': '是你目前的歌曲集合。儲存集合讓你可以快照它並在之後返回——即使你關閉瀏覽器或開始處理其他集合。',
    id:      'adalah koleksi lagu kamu saat ini. Menyimpan set itu kayak nge-save game — bisa balik kapan aja, biar browser ditutup atau kamu lagi sibuk ngerjain set lain!',
    jv:      'yaiku koleksi lagumu saiki. Nyimpen set kuwi kaya nyelehke gaweyan ing lemari, mengko iso dijupuk maneh kapan wae, senajan browser ditutup utawa lagi nggarap set liya, nak.',
  },
  'The header shows the active set\'s name (e.g.': {
    la:      'Caput ostendit nomen collectionis activae (e.g.',
    'zh-TW': '標題顯示作用中集合的名稱（例如',
    id:      'Header menampilkan nama set aktif (mis.',
    jv:      'Header nampilake jeneng set aktif (tuladha',
  },
  '), or': {
    la:      '), vel',
    'zh-TW': '），或',
    id:      '), atau',
    jv:      '), utawa',
  },
  'Sunday Service': {
    la:      'Ministerium Dominicale',
    'zh-TW': '主日崇拜',
    id:      'Kebaktian Minggu',
    jv:      'Ibadah Minggu',
  },
  'if nothing is saved yet. Click it to open the': {
    la:      'si nihil adhuc servatum est. Premes eam ut aperias',
    'zh-TW': '若尚未儲存任何內容。點擊開啟',
    id:      'kalau belum ada yang tersimpan. Klik untuk buka',
    jv:      'yen durung ana sing kasimpen. Klik kanggo mbukak',
  },
  'panel. At the top of the panel, the current set name and last-modified time are shown — or': {
    la:      'tabulam. In summo tabulae, nomen collectionis currentis et tempus ultimae modificationis monstrantur — vel',
    'zh-TW': '面板。面板頂部顯示目前集合名稱和最後修改時間——或',
    id:      'panel. Di bagian atas panel, nama set saat ini dan waktu terakhir diubah ditampilkan — atau',
    jv:      'panel. Ing ndhuwur panel, jeneng set saiki lan wektu terakhir diowahi ditampilake — utawa',
  },
  'if no set is active yet.': {
    la:      'si nulla collectio adhuc activa est.',
    'zh-TW': '（若尚無作用中的集合）。',
    id:      'kalau belum ada set yang aktif.',
    jv:      'yen durung ana set sing aktif.',
  },
  'Starting a new set': {
    la:      'Initium Collectionis Novae',
    'zh-TW': '開始新的集合',
    id:      'Mulai Set Baru',
    jv:      'Miwiti Set Anyar',
  },
  'in the header (or': {
    la:      'in capite (vel',
    'zh-TW': '（標題中）（或',
    id:      'di header (atau',
    jv:      'ing header (utawa',
  },
  'inside the Saved Sets panel) to clear the workspace and start fresh. On mobile the header button shows just the': {
    la:      'intra tabulam Collectionum Servatarum) ut spatium laboris purges et denuo incipiatur. In telephono papilio capitis solum',
    'zh-TW': '（在已儲存集合面板內）以清除工作區並重新開始。在手機上，標題按鈕僅顯示',
    id:      'di dalam panel Set Tersimpan) untuk bersihkan workspace dan mulai dari awal. Di HP tombol header cuma tampilkan',
    jv:      'ing jero panel Set Kasimpen) kanggo ngresiki workspace lan miwiti saka awal. Ing HP, tombol header mung nampilake',
  },
  'icon.': {
    la:      'iconem ostendit.',
    'zh-TW': '圖示。',
    id:      'ikonnya aja.',
    jv:      'ikon wae.',
  },
  'If you\'re currently in a named set (it\'s already autosaved), the workspace clears immediately.': {
    la:      'Si nunc in collectione nominata es (iam automatice servata est), spatium laboris statim purgatur.',
    'zh-TW': '如果你目前在一個已命名的集合中（已自動儲存），工作區會立即清除。',
    id:      'Kalau kamu lagi di set yang sudah dinamai (sudah autosaved), workspace langsung bersih.',
    jv:      'Yen saiki kowe ana ing set sing wis dijenengi (wis disimpen otomatis), workspace langsung resik.',
  },
  'If you have unsaved work, a prompt appears: enter a name to save it first, or click': {
    la:      'Si laborem non servatum habes, monitio apparet: inscribe nomen ut prius serves, vel premes',
    'zh-TW': '如果你有未儲存的工作，會出現提示：輸入名稱先儲存，或點擊',
    id:      'Kalau ada pekerjaan yang belum disimpan, akan muncul prompt: masukkan nama untuk simpan dulu, atau klik',
    jv:      'Yen ana gaweyan sing durung kasimpen, ana prompt: tulis jeneng kanggo nyimpen dhisik, utawa klik',
  },
  'to discard and continue.': {
    la:      'ut omittas et pergas.',
    'zh-TW': '放棄並繼續。',
    id:      'untuk buang dan lanjut.',
    jv:      'kanggo mbuwang lan nerusake.',
  },
  'Saving a set': {
    la:      'Servare Collectionem',
    'zh-TW': '儲存集合',
    id:      'Menyimpan Set',
    jv:      'Nyimpen Set',
  },
  'Type a name for your set (e.g.': {
    la:      'Inscribe nomen pro collectione tua (e.g.',
    'zh-TW': '為你的集合輸入名稱（例如',
    id:      'Ketik nama untuk set kamu (mis.',
    jv:      'Ketik jeneng kanggo set-mu (tuladha',
  },
  'Sunday 29 June': {
    la:      'Dominica XXIX Iunii',
    'zh-TW': '6月29日主日',
    id:      'Minggu 29 Juni',
    jv:      'Minggu 29 Juni',
  },
  'in the input at the top of the panel and click': {
    la:      'in campo in summo tabulae et premes',
    'zh-TW': '在面板頂部的輸入框中，然後點擊',
    id:      'di input di atas panel, lalu klik',
    jv:      'ing input ing ndhuwur panel, banjur klik',
  },
  '(or press': {
    la:      '(vel premes',
    'zh-TW': '（或按',
    id:      '(atau tekan',
    jv:      '(utawa pencet',
  },
  'If you save again with the same name, the existing set is updated in place rather than duplicated.': {
    la:      'Si iterum cum eodem nomine servas, collectio existens in situ renovatur potius quam duplicatur.',
    'zh-TW': '如果用相同名稱再次儲存，現有集合會就地更新，而不是重複新增。',
    id:      'Kalau simpan lagi dengan nama yang sama, set yang ada langsung diperbarui, bukan diduplikat.',
    jv:      'Yen nyimpen maneh nganggo jeneng sing padha, set sing wis ana diperbarui ing kono, ora diduplikat.',
  },
  'Up to 20 sets can be stored. If you exceed this limit, the oldest set is removed.': {
    la:      'Usque ad 20 collectiones servari possunt. Si hunc limitem superas, collectio vetustissima removetur.',
    'zh-TW': '最多可以儲存 20 個集合。超過限制時，最舊的集合會被移除。',
    id:      'Maksimal 20 set bisa disimpan. Kalau melebihi batas, set paling lama dihapus.',
    jv:      'Nganti 20 set iso disimpen. Yen ngluwihi wates, set sing paling lawas dicopot.',
  },
  'Autosave to the active set': {
    la:      'Custodia Automatica ad Collectionem Activam',
    'zh-TW': '自動儲存至作用中集合',
    id:      'Autosave ke Set Aktif',
    jv:      'Simpen Otomatis menyang Set Aktif',
  },
  'Once a set is saved or loaded, it becomes the': {
    la:      'Postquam collectio servata vel onerata est, fit',
    'zh-TW': '一旦集合被儲存或載入，它就成為',
    id:      'Setelah set disimpan atau dimuat, ia menjadi',
    jv:      'Sawise set kasimpen utawa dimuat, dadi',
  },
  'active set': {
    la:      'collectio activa',
    'zh-TW': '作用中集合',
    id:      'set aktif',
    jv:      'set aktif',
  },
  '. Every edit you make — chord changes, transpositions, section moves — is automatically saved back to that set in real time. No need to keep clicking Save.': {
    la:      '. Omnis emendatio quam facis — mutationes chordarum, transpositiones, motus sectionum — automatice ad illam collectionem in tempore reali servantur. Non opus est Servare iterum et iterum premere!',
    'zh-TW': '。你所做的每個編輯——和弦更改、移調、段落移動——都會即時自動儲存回該集合。不需要一直點儲存！',
    id:      '. Setiap edit yang kamu buat — perubahan akor, transposisi, pindah bagian — otomatis disimpan ke set itu secara real time. Gak perlu terus-terusan klik Simpan!',
    jv:      '. Saben edit sing kowe gawe — owahane akor, transposisi, mindah bagian — otomatis disimpen bali menyang set kasebut kanthi real time. Ora perlu terus-terusan klik Simpen, nak.',
  },
  'The active set is highlighted with an': {
    la:      'Collectio activa insignita est cum',
    'zh-TW': '作用中集合以',
    id:      'Set aktif disorot dengan badge',
    jv:      'Set aktif disorot nganggo badge',
  },
  'badge in the panel, and its name appears in the header button.': {
    la:      'insigni in tabula, et nomen eius in papilione capitis apparet.',
    'zh-TW': '徽章在面板中突出顯示，其名稱出現在標題按鈕中。',
    id:      'di panel, dan namanya muncul di tombol header.',
    jv:      'ing panel, lan jenenge katon ing tombol header.',
  },
  'If you reload the page, the app restores both your songs and the active set so you can continue right where you left off.': {
    la:      'Si paginam recargas, applicatio cantus tuos et collectionem activam restaurat ut ibi pergere possis ubi reliquisti.',
    'zh-TW': '如果你重新載入頁面，App 會還原你的歌曲和作用中集合，讓你從上次停下的地方繼續。',
    id:      'Kalau kamu reload halaman, app memulihkan lagu dan set aktif kamu sehingga bisa lanjut tepat dari mana kamu berhenti.',
    jv:      'Yen kowe reload kaca, app mulihake lagumu lan set aktif supaya kowe iso nerusake saka ngendi kowe mungkasi.',
  },
  'Loading a set': {
    la:      'Onerare Collectionem',
    'zh-TW': '載入集合',
    id:      'Memuat Set',
    jv:      'Muat Set',
  },
  'Each saved set shows its name, save date, and song count. Click': {
    la:      'Quaelibet collectio servata nomen, diem servationis, et numerum cantuum ostendit. Premes',
    'zh-TW': '每個已儲存的集合顯示其名稱、儲存日期和歌曲數量。點擊',
    id:      'Setiap set tersimpan menampilkan nama, tanggal simpan, dan jumlah lagu. Klik',
    jv:      'Saben set kasimpen nampilake jeneng, tanggal simpen, lan cacah lagu. Klik',
  },
  'to restore it — the editor updates immediately and that set becomes the new active set.': {
    la:      'ut eam restaures — editor statim renovatur et illa collectio fit nova collectio activa.',
    'zh-TW': '還原它——編輯器立即更新，該集合成為新的作用中集合。',
    id:      'untuk pulihkannya — editor langsung update dan set itu jadi set aktif baru.',
    jv:      'kanggo mulihake — editor langsung diperbarui lan set kasebut dadi set aktif anyar.',
  },
  'Managing sets': {
    la:      'Administratio Collectionum',
    'zh-TW': '管理集合',
    id:      'Kelola Set',
    jv:      'Ngatur Set',
  },
  'Rename': {
    la:      'Renominare',
    'zh-TW': '重新命名',
    id:      'Ganti Nama',
    jv:      'Ngganti Jeneng',
  },
  'click the pencil icon (✎) on any set to rename it inline, then press': {
    la:      'premes iconem stili (✎) in qualibet collectione ut eam in situ renomines, deinde premes',
    'zh-TW': '點擊任何集合上的鉛筆圖示（✎）以就地重新命名，然後按',
    id:      'klik ikon pensil (✎) di set mana saja untuk ganti nama langsung, lalu tekan',
    jv:      'klik ikon pensil (✎) ing set apa wae kanggo ngganti jeneng langsung, banjur pencet',
  },
  'or click elsewhere.': {
    la:      'vel alibi premes.',
    'zh-TW': '或點擊其他地方。',
    id:      'atau klik di tempat lain.',
    jv:      'utawa klik neng ngendi wae.',
  },
  'click the ✕ button to permanently remove a set from storage.': {
    la:      'premes papilionem ✕ ut collectionem permanenter e memoria removes.',
    'zh-TW': '點擊 ✕ 按鈕以永久從儲存中移除集合。',
    id:      'klik tombol ✕ untuk hapus set dari storage secara permanen.',
    jv:      'klik tombol ✕ kanggo mbusak set saka storage kanthi permanen.',
  },
  'Sets are stored only in': {
    la:      'Collectiones servantur solum in',
    'zh-TW': '集合僅儲存在',
    id:      'Set hanya tersimpan di',
    jv:      'Set mung disimpen ing',
  },
  'this browser': {
    la:      'hoc navigatro',
    'zh-TW': '此瀏覽器',
    id:      'browser ini',
    jv:      'browser iki',
  },
  'on': {
    la:      'in',
    'zh-TW': '的',
    id:      'di',
    jv:      'ing',
  },
  'this device': {
    la:      'hoc instrumento',
    'zh-TW': '此裝置上',
    id:      'perangkat ini',
    jv:      'perangkat iki',
  },
  '. Use export/import (below) to move them to another device.': {
    la:      '. Adhibere exportationem/importationem (infra) ut eas ad aliud instrumentum moves.',
    'zh-TW': '。使用匯出/匯入（下方）將它們移到另一台裝置。',
    id:      '. Gunakan ekspor/impor (di bawah) untuk memindahkannya ke perangkat lain.',
    jv:      '. Nggunakake ekspor/impor (ing ngisor) kanggo mindahake menyang perangkat liya.',
  },
  'Exporting and importing set files': {
    la:      'Exportatio et Importatio Fasciculorum Collectionum',
    'zh-TW': '匯出與匯入集合檔案',
    id:      'Ekspor dan Impor File Set',
    jv:      'Ekspor lan Impor File Set',
  },
  'Export (↓)': {
    la:      'Exportare (↓)',
    'zh-TW': '匯出（↓）',
    id:      'Ekspor (↓)',
    jv:      'Ekspor (↓)',
  },
  'click the download button on any saved set to save it as a': {
    la:      'premes papilionem descensus in qualibet collectione servata ut eam ut',
    'zh-TW': '點擊任何已儲存集合上的下載按鈕，將其儲存為',
    id:      'klik tombol unduh di set tersimpan mana saja untuk simpan sebagai file',
    jv:      'klik tombol unduh ing set kasimpen apa wae kanggo nyimpen minangka file',
  },
  'file. This file contains the full song data including all edits, transpositions, and chord positions.': {
    la:      'fasciculum serves. Hic fasciculus continet data plena cantuum cum omnibus emendationibus, transpositionibus, et positionibus chordarum.',
    'zh-TW': '檔案。此檔案包含完整歌曲資料，包括所有編輯、移調和和弦位置。',
    id:      '.wt. File ini berisi data lagu lengkap termasuk semua editan, transposisi, dan posisi akor.',
    jv:      '.wt. File iki ngemot data lagu lengkap kalebu kabeh editan, transposisi, lan posisi akor.',
  },
  'Import from the Saved Sets panel': {
    la:      'Importare e Tabula Collectionum Servatarum',
    'zh-TW': '從已儲存集合面板匯入',
    id:      'Impor dari Panel Set Tersimpan',
    jv:      'Impor saka Panel Set Kasimpen',
  },
  'at the top of the panel, pick a previously exported': {
    la:      'in summo tabulae, elige antea exportatum',
    'zh-TW': '在面板頂部，選擇先前匯出的',
    id:      'di atas panel, pilih file',
    jv:      'ing ndhuwur panel, pilih file',
  },
  'file, and the set loads into the editor immediately. It\'s also saved to your set list so you can return to it later.': {
    la:      'fasciculum, et collectio statim in editorem oneratur. Etiam in lista collectionum tuarum servatur ut ad eam postea redire possis.',
    'zh-TW': '檔案，集合會立即載入到編輯器中。它也會儲存到你的集合列表中，方便你之後返回。',
    id:      '.wt yang pernah diekspor, dan set langsung dimuat ke editor. Set juga disimpan ke daftar set kamu biar bisa balik lagi nanti.',
    jv:      '.wt sing tau diekspor, lan set langsung dimuat menyang editor. Set uga kasimpen menyang dhaftar set-mu supaya iso bali mengko.',
  },
  'Import from the upload page': {
    la:      'Importare e Pagina Importationis',
    'zh-TW': '從上傳頁面匯入',
    id:      'Impor dari Halaman Upload',
    jv:      'Impor saka Kaca Upload',
  },
  'on the landing/upload page, click': {
    la:      'in pagina initiali/importationis, premes',
    'zh-TW': '在登陸/上傳頁面，點擊',
    id:      'di halaman landing/upload, klik',
    jv:      'ing kaca landing/upload, klik',
  },
  'to open a': {
    la:      'ut aperias',
    'zh-TW': '以直接開啟',
    id:      'untuk buka file',
    jv:      'kanggo mbukak file',
  },
  'file directly without going through the panel.': {
    la:      'fasciculum directe sine tabula.',
    'zh-TW': '檔案，無需透過面板。',
    id:      '.wt langsung tanpa perlu lewat panel.',
    jv:      '.wt langsung tanpa perlu liwat panel.',
  },
  'files are plain JSON and can be shared via email, cloud drive, AirDrop, or any other file-transfer method.': {
    la:      'fascicula sunt JSON simplex et communicari possunt per epistulamelectronicam, discum nubis, AirDrop, vel quamlibet aliam methodum translationis fasciculorum.',
    'zh-TW': '檔案是純 JSON 格式，可以透過電子郵件、雲端硬碟、AirDrop 或任何其他檔案傳輸方式分享。',
    id:      'file berformat JSON biasa dan bisa dibagikan via email, cloud drive, AirDrop, atau cara transfer file lainnya.',
    jv:      'file iku JSON biasa lan iso dibagi liwat email, cloud drive, AirDrop, utawa cara transfer file liyane.',
  },

  // ── §10 Appearance & accessibility ──
  'button in the app header to open the Settings panel. All display and export preferences live here and are remembered between visits.': {
    la:      'papilionem in capite applicationis ut tabulam Optionum aperias. Omnes praeferentiae ostentationis et exportationis hic habitant et inter visitas memoria tenentur.',
    'zh-TW': 'App 標題中的按鈕開啟設定面板。所有顯示和匯出偏好都在這裡，並在訪問之間記住。',
    id:      'di header app untuk buka panel Pengaturan. Semua preferensi tampilan dan ekspor ada di sini dan diingat antar kunjungan.',
    jv:      'ing header app kanggo mbukak panel Setelan. Kabeh preferensi tampilan lan ekspor ana ing kene lan dieling-eling antarane kunjungan.',
  },
  'choose an accent color theme: Blue (default), Pink, Red, Amber, or Green. The selected color applies to buttons, chord display, and interactive elements throughout the app. Works with both Light and Dark mode.': {
    la:      'elige thema coloris accentus: Caeruleum (defalta), Roseum, Rubrum, Succinum, vel Viride. Color electus papilionibus, ostentioni chordarum, et elementis interactivis per totam applicationem applicatur. Cum modo Lucis et Tenebrarum laborat.',
    'zh-TW': '選擇強調色主題：藍色（預設）、粉色、紅色、琥珀色或綠色。所選顏色應用於整個 App 的按鈕、和弦顯示和互動元素。支援淺色和深色模式！',
    id:      'pilih tema warna aksen: Biru (default), Pink, Merah, Amber, atau Hijau. Warna yang dipilih berlaku untuk tombol, tampilan akor, dan elemen interaktif di seluruh app. Cocok dengan mode Terang maupun Gelap!',
    jv:      'pilih tema warna aksen: Biru (default), Pink, Abang, Amber, utawa Ijo. Warna sing dipilih diterapake menyang tombol, tampilan akor, lan elemen interaktif ing sak kabehe app. Cocok karo mode Padhang lan Peteng.',
  },
  'toggle between Light and Dark mode. WorshipToolkit follows your system\'s preference the first time you open it.': {
    la:      'commuta inter modum Lucis et Tenebrarum. WorshipToolkit praeferentiam systematis tui prima vice qua eam aperis sequitur.',
    'zh-TW': '在淺色和深色模式之間切換。WorshipToolkit 第一次開啟時會跟隨你的系統偏好設定。',
    id:      'beralih antara mode Terang dan Gelap. Pertama kali dibuka, WorshipToolkit nurut aja sama settingan sistem kamu — gak neko-neko!',
    jv:      'ngalih antarane mode Padhang lan Peteng. Pisanan dibukak, WorshipToolkit manut wae karo setelan sistem-mu, ora neko-neko, nak.',
  },
  'choose how chord and key names are spelled:': {
    la:      'eligere quomodo nomina chordarum et clavium scribantur:',
    'zh-TW': '選擇和弦和調性名稱的拼寫方式：',
    id:      'pilih cara penulisan nama akor dan kunci:',
    jv:      'pilih carane nulis jeneng akor lan kunci:',
  },
  'always use flat notation (Db, Eb, Ab, Bb, Gb) everywhere.': {
    la:      'semper adhibere notationem bemolium (Db, Eb, Ab, Bb, Gb) ubique.',
    'zh-TW': '在所有地方始終使用降記號（Db, Eb, Ab, Bb, Gb）。',
    id:      'selalu gunakan notasi mol (Db, Eb, Ab, Bb, Gb) di mana saja.',
    jv:      'tansah nggunakake notasi mol (Db, Eb, Ab, Bb, Gb) ing ngendi wae.',
  },
  'default': {
    la:      'defalta',
    'zh-TW': '預設',
    id:      'default',
    jv:      'bawaan',
  },
  'uses conventional key-context spelling: flat keys use flats, sharp keys use sharps.': {
    la:      'adhibet scripturam conventionalem contextus clavis: claves bemolium bemolia adhibent, claves diesis diesim adhibent.',
    'zh-TW': '使用常規調性上下文拼寫：降調使用降記號，升調使用升記號。',
    id:      'menggunakan ejaan konteks kunci konvensional: kunci mol pakai mol, kunci kres pakai kres.',
    jv:      'nggunakake ejaan konteks kunci konvensional: kunci mol nggunakake mol, kunci kres nggunakake kres.',
  },
  'always use sharp notation (C#, D#, G#, A#, F#) everywhere.': {
    la:      'semper adhibere notationem diesis (C#, D#, G#, A#, F#) ubique.',
    'zh-TW': '在所有地方始終使用升記號（C#, D#, G#, A#, F#）。',
    id:      'selalu gunakan notasi kres (C#, D#, G#, A#, F#) di mana saja.',
    jv:      'tansah nggunakake notasi kres (C#, D#, G#, A#, F#) ing ngendi wae.',
  },
  'The choice applies simultaneously to chord buttons in the editor, the toolbar and sidebar key display, the "Jump to" dropdown list, and all PDF and Markdown exports.': {
    la:      'Electio simul applicatur papilionibus chordarum in editore, ostentioni clavis in barra instrumentorum et laterali, listae cadenti "Salire ad", et omnibus exportationibus PDF et Markdown.',
    'zh-TW': '這個選擇同時應用於編輯器中的和弦按鈕、工具列和側邊欄的調性顯示、「跳至」下拉列表，以及所有 PDF 和 Markdown 匯出。',
    id:      'Pilihan berlaku serentak untuk tombol akor di editor, tampilan kunci di toolbar dan sidebar, daftar dropdown "Lompat ke", dan semua ekspor PDF dan Markdown.',
    jv:      'Pilihan iki diterapake bebarengan menyang tombol akor ing editor, tampilan kunci ing toolbar lan sidebar, dhaftar dropdown "Loncat menyang", lan kabeh ekspor PDF lan Markdown.',
  },
  'use': {
    la:      'adhibere',
    'zh-TW': '使用',
    id:      'gunakan',
    jv:      'nggunakake',
  },
  'to scale the whole app\'s text up or down (13–32 px). Useful for large-screen presentations at the larger end.': {
    la:      'ut textum totius applicationis sursum vel deorsum scias (13–32 px). Utile pro praesensationibus in schermate magno ad extremum maius.',
    'zh-TW': '放大或縮小整個 App 的文字（13–32px）。在較大端對大螢幕展示非常有用！',
    id:      'untuk perbesar/perkecil teks seluruh app (13–32px). Berguna untuk presentasi layar besar di ukuran yang lebih besar!',
    jv:      'kanggo mbakake utawa ngecilike teks kabeh app (13–32px). Migunani banget kanggo presentasi layar gede.',
  },
  'sets the font size used in exported PDFs (10–20 px, default 14 px), independently of the on-screen text size. Sizes above 14 px switch to single-column layout; a warning is shown when this threshold is exceeded.': {
    la:      'ponit magnitudinem textus in PDF exportatis (10–20 px, defalta 14 px), independenter a magnitudine textus in schemate. Magnitudines supra 14 px ad dispositionem unius columnae commutant; monitio ostenditur cum hic limes superatur.',
    'zh-TW': '設定匯出 PDF 中使用的字型大小（10–20px，預設 14px），與螢幕文字大小無關。超過 14px 的尺寸切換為單欄版面；超過此閾值時會顯示警告。',
    id:      'mengatur ukuran font yang digunakan di PDF ekspor (10–20px, default 14px), terlepas dari ukuran teks di layar. Ukuran di atas 14px beralih ke layout satu kolom; peringatan ditampilkan kalau batas ini terlampaui.',
    jv:      'nyetel ukuran font sing digunakake ing PDF ekspor (10–20px, default 14px), independen saka ukuran teks ing layar. Ukuran ing ndhuwur 14px ngalih menyang layout siji kolom; peringatan ditampilake yen wates iki dilewati.',
  },
  'Five UI languages are available. Switch using the pill buttons in': {
    la:      'Quinque linguae interfaciei adsunt. Commuta adhibendo papiliones in',
    'zh-TW': '提供五種介面語言。使用藥丸按鈕切換，位於',
    id:      'Ada lima bahasa UI yang tersedia. Ganti pakai tombol pill di',
    jv:      'Ana lima basa UI sing kasedhiya. Ganti nganggo tombol pill ing',
  },
  'or directly from the row of pills at the top of this manual page.': {
    la:      'vel directe ex serie papilionum in summo huius paginae manualis.',
    'zh-TW': '或直接從本手冊頁面頂部的藥丸列切換。',
    id:      'atau langsung dari baris tombol pill di atas halaman manual ini.',
    jv:      'utawa langsung saka baris tombol pill ing ndhuwur kaca manual iki.',
  },
  'humorous Latin. Activating it shows a toast notification. Unlocks the': {
    la:      'Latinum iocosum. Activatio eius demonstrationem panis tosti ostendit. Reserat',
    'zh-TW': '幽默拉丁文。啟用時會顯示提示通知，還會解鎖',
    id:      'Latin yang lucu. Mengaktifkannya menampilkan notifikasi toast. Membuka kunci bagian',
    jv:      'Latinum sing lucu. Ngaktifake bakal nampilake notifikasi toast. Mbukak bagian',
  },
  'section on this page.': {
    la:      'sectionem in hac pagina.',
    'zh-TW': '部分在本頁面上。',
    id:      'di halaman ini.',
    jv:      'ing kaca iki.',
  },
  'Traditional Chinese': {
    la:      'Sinica Traditionalis',
    'zh-TW': '繁體中文',
    id:      'Bahasa Mandarin Tradisional',
    jv:      'Mandarin Tradisional',
  },
  'Javanese': {
    la:      'Iavanica',
    'zh-TW': '爪哇語',
    id:      'Bahasa Jawa',
    jv:      'Basa Jawa',
  },
  'Language preference is saved per set — loading a saved set restores the language it was saved with. The home page app name and tagline also change per language (because why not).': {
    la:      'Praeferentia linguae per collectionem servatur — oneratio collectionis servatae linguam cum qua servata est restaurat. Nomen applicationis in pagina initiali et inscriptio etiam per linguam mutantur (quia cur non?).',
    'zh-TW': '語言偏好按集合儲存——載入已儲存的集合會還原它儲存時的語言。首頁的 App 名稱和標語也會隨語言變更（因為何不呢？）。',
    id:      'Preferensi bahasa disimpan per set — memuat set yang tersimpan memulihkan bahasa yang digunakan saat disimpan. Nama app dan tagline di halaman utama juga berubah per bahasa (karena kenapa enggak?).',
    jv:      'Preferensi basa kasimpen per set — muat set kasimpen mulihake basa sing digunakake nalika disimpen. Jeneng app lan tagline ing kaca ngarep uga owah per basa (amarga kenapa ora?).',
  },

  // ── §11 Tips, autosave & troubleshooting ──
  'Autosave': {
    la:      'Custodia Automatica',
    'zh-TW': '自動儲存',
    id:      'Autosave',
    jv:      'Simpen Otomatis',
  },
  'your set is continuously saved to this browser\'s local storage. Refreshing or closing the tab won\'t lose your work; only starting a new set via': {
    la:      'collectio tua continue in memoria locali huius navigatri servatur. Renovatio vel clausio tabulae non perdet laborem tuum; solum initium novae collectionis per',
    'zh-TW': '你的集合持續儲存到此瀏覽器的本地存儲。重新整理或關閉標籤不會丟失你的工作；只有通過',
    id:      'set kamu terus-menerus disimpan ke local storage browser ini. Refresh atau tutup tab gak akan kehilangan pekerjaan kamu; hanya memulai set baru via',
    jv:      'set-mu terus-terusan disimpen menyang local storage browser iki. Refresh utawa nutup tab ora bakal ilang gaweyanmu; mung miwiti set anyar liwat',
  },
  'in the header clears the workspace.': {
    la:      'in capite spatium laboris purgat.',
    'zh-TW': '標題中開始新集合才會清除工作區。',
    id:      'di header yang membersihkan workspace.',
    jv:      'ing header sing ngresiki workspace.',
  },
  'Everything is local': {
    la:      'Omnia Localia Sunt',
    'zh-TW': '一切都在本地',
    id:      'Semua Tersimpan Lokal',
    jv:      'Kabeh Lokal',
  },
  'no song data leaves your device. Clearing your browser\'s site data will remove your saved sets.': {
    la:      'nulla data cantuum instrumentum tuum relinquunt. Expurgatio datae situs navigatri tui collectiones tuas servatas removebit.',
    'zh-TW': '沒有歌曲資料會離開你的裝置。清除瀏覽器的網站資料會移除你的已儲存集合。',
    id:      'gak ada data lagu yang kabur dari perangkat kamu. Tapi awas, hapus data situs browser = set kamu ikut lenyap juga!',
    jv:      'ora ana data lagu sing lunga saka perangkat-mu. Nanging ati-ati, ngresiki data situs browser bakal melu mbusak set kasimpen-mu, nak.',
  },
  'Nothing parsed from my PDF?': {
    la:      'Nihil e PDF meo lectum est?',
    'zh-TW': 'PDF 沒有解析到任何內容？',
    id:      'Gak ada yang ke-parse dari PDF?',
    jv:      'Ora ana sing diurai saka PDF-ku?',
  },
  'Make sure it\'s an actual SongSelect chord chart export, not a scanned/photographed image — the parser reads text, not pixels.': {
    la:      'Verifica esse exportationem veram chartarum chordarum SongSelect, non imaginem depictam/photographatam — machina textum legit, non pixelos. Oculi machinae non sunt!',
    'zh-TW': '確認這是實際的 SongSelect 和弦圖匯出，不是掃描/拍攝的圖片——解析器讀取文字，不讀像素！',
    id:      'Pastiin itu ekspor chord chart SongSelect yang asli, bukan gambar scan/foto — parser baca teks, bukan piksel ya!',
    jv:      'Pastikna iku ekspor chord chart SongSelect sing beneran, dudu gambar scan/foto — parser maca teks, ora piksel, nak.',
  },
  'Chord didn\'t land where I dragged it?': {
    la:      'Chorda non cecidit ubi eam traxi?',
    'zh-TW': '和弦沒有落在我拖到的地方？',
    id:      'Akor gak landing di tempat yang aku seret?',
    jv:      'Akor ora mudhun ing panggonan sing tak seret?',
  },
  'Positions snap to whole characters so chords never overlap; drop it a little further along the line if it snapped back.': {
    la:      'Positiones ad characteres integros coniunguntur ne chordae umquam superponantur; depone eam paululum longius in linea si resilivit.',
    'zh-TW': '位置會對齊到完整字符，這樣和弦就永遠不會重疊；如果它彈回去了，就沿著行再往前一點放。',
    id:      'Posisi snap ke karakter utuh supaya akor gak pernah tumpang tindih; taruh sedikit lebih jauh di baris kalau balik lagi.',
    jv:      'Posisi snap menyang karakter lengkap supaya akor ora pernah tumpang tindih; seleh sethithik luwih adoh ing baris yen bali maneh.',
  },
  'Want a clean slate for one song only?': {
    la:      'Vis tabulam puram pro uno cantu solum?',
    'zh-TW': '只想為單首歌清空畫布？',
    id:      'Mau mulai bersih untuk satu lagu aja?',
    jv:      'Pengen mulai bersih kanggo siji lagu wae?',
  },
  'You can remove and re-add sections/lines rather than starting a whole new upload.': {
    la:      'Potes sectiones/lineas removere et readhere potius quam ab initio totum oneras.',
    'zh-TW': '你可以移除並重新新增段落/行，而不必整個重新上傳。',
    id:      'Kamu bisa hapus dan tambah ulang bagian/baris daripada mulai upload baru dari awal.',
    jv:      'Kowe iso mbusak lan nambah maneh bagian/baris tinimbang miwiti upload anyar saka nol.',
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
