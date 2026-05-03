# Functional Specification Document (FSD)

**Project Name:** Image to Listmonk Template Converter
**Version:** 2.2 (Reviewed — Semua Ambiguitas Diselesaikan)
**Date:** 3 Mei 2026
**Status:** Final

---

## Daftar Isi

1. [Pendahuluan](#1-pendahuluan)
2. [Scope & Out of Scope](#2-scope--out-of-scope)
3. [User Personas & Environment](#3-user-personas--environment)
4. [Arsitektur Sistem](#4-arsitektur-sistem)
5. [Fitur Detail](#5-fitur-detail)
   - 5.1 Autentikasi
   - 5.2 Upload & Image Analysis Pipeline
   - 5.3 AI Code Generation
   - 5.4 Split-View Editor & Chat Revisor
   - 5.5 Save & Listmonk Integration
6. [User Flow Lengkap](#6-user-flow-lengkap)
7. [API Contract (Internal)](#7-api-contract-internal)
8. [Data Model](#8-data-model)
9. [Error Handling & Edge Cases](#9-error-handling--edge-cases)
10. [Kebutuhan Non-Fungsional](#10-kebutuhan-non-fungsional)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Open Questions & Asumsi](#12-open-questions--asumsi)

---

## 1. Pendahuluan

### 1.1 Latar Belakang

Content creator yang menggunakan Listmonk sebagai platform email marketing menghadapi hambatan teknis signifikan: untuk membuat template newsletter yang sesuai dengan desain visual, mereka harus menulis HTML email-safe (berbasis tabel), inline CSS, dan sintaks Go Template secara manual. Proses ini membutuhkan keahlian coding yang tidak dimiliki oleh sebagian besar content creator, menyebabkan ketergantungan pada developer atau penggunaan template generik yang tidak sesuai brand.

### 1.2 Tujuan Produk

Membangun aplikasi web internal single-user yang memungkinkan content creator untuk:

1. Mengunggah mockup/desain visual email (dalam format gambar)
2. Mendapatkan kode HTML Listmonk-compatible secara otomatis via AI pipeline
3. Mereview dan merevisi hasil lewat chat interface
4. Menyimpan langsung ke server Listmonk

### 1.3 Definisi & Akronim

| Istilah | Definisi |
|---|---|
| Listmonk | Open-source self-hosted newsletter platform |
| Go Template | Sintaks templating bawaan bahasa Go, dipakai Listmonk untuk variabel dinamis |
| Email-Safe HTML | HTML berbasis tabel dengan inline CSS, kompatibel dengan email client seperti Gmail, Outlook |
| OpenAI Vision | Kemampuan model GPT-4o untuk membaca dan menganalisis konten gambar |
| Image Slicing | Proses pemotongan area spesifik dari gambar berdasarkan koordinat bounding box |
| FSD | Functional Specification Document |

---

## 2. Scope & Out of Scope

### 2.1 Dalam Scope (v1.0)

- Single-user web app dengan autentikasi sederhana (HTTPS + session)
- Upload gambar JPG/PNG — **selalu berupa full mockup email dari header sampai footer**
- AI pipeline: analisis gambar → crop otomatis aset `structural` + **generate aset `placeholder` via gpt-image-2** → upload ke Listmonk media → generate HTML
- **Variabel dinamis Go Template wajib dideteksi dan disisipkan** di setiap template
- Split-view: preview render HTML + Monaco Editor + **drag & drop reorder section visual**
- **1 level undo** setelah Chat Revisor mengubah HTML
- Chat revisor berbasis OpenAI untuk iterasi kode
- Simpan template ke Listmonk (create baru atau update existing)
- Error handling: **restart dari awal** jika pipeline gagal di tengah jalan
- Deployment: **langsung di VPS tanpa Docker**, runtime Node.js

### 2.2 Luar Scope (tidak dikerjakan di v1.0)

- Multi-user / team collaboration
- Upload desain dari URL atau Figma/Sketch
- Upload aset gambar berkualitas tinggi secara manual — aset `structural` di-crop otomatis dari mockup, aset `placeholder` di-generate via AI
- Full undo history / version control template (hanya 1 level undo)
- Scheduling atau sending campaign langsung dari aplikasi ini
- Dukungan format selain JPG dan PNG (misal: PDF, SVG, PSD)
- Input mockup per-section — hanya full email yang didukung
- Dark mode email template
- A/B testing template
- Job queue berbasis Redis/Bull (in-memory cukup untuk 1–5x/minggu)
- Rate limiting login / IP allowlist (HTTPS + session dianggap cukup)

---

## 3. User Personas & Environment

### 3.1 Primary User: Content Creator

| Atribut | Detail |
|---|---|
| Jumlah | 1 orang (single-user app) |
| Kemampuan teknis | Non-developer; familiar dengan tools desain visual |
| Device | Desktop / laptop (browser) |
| Workflow utama | Mendesain di tools visual (Canva, Figma, dll) → export sebagai gambar → upload ke aplikasi ini |
| Pain point | Tidak bisa coding HTML/CSS; proses manual lambat |

### 3.2 Environment Deployment

| Parameter | Nilai |
|---|---|
| Deployment target | VPS (bare metal, tanpa Docker) |
| Runtime | Node.js (langsung di VPS) |
| Aksesibilitas | Private (behind HTTPS + session auth) |
| Keamanan transport | HTTPS wajib (TLS di reverse proxy, misal Nginx) |
| Listmonk instance | Self-hosted, URL dikonfigurasi via `.env` |
| Listmonk auth | **Authorization token header**: `Authorization: token api_user:token` (default). BasicAuth `api_user:token` tersedia sebagai fallback. API user & token dibuat di Listmonk Admin → Users. |
| Browser support | Chrome/Firefox terbaru (tidak perlu IE/legacy) |
| Frekuensi pemakaian | 1–5x per minggu (low traffic, in-memory job store cukup) |

---

## 4. Arsitektur Sistem

### 4.1 High-Level Architecture

```
[Browser / Frontend — React.js + TailwindCSS]
        |
        | HTTPS (REST API)
        v
[Backend Server — Node.js + Express]
        |
        |── OpenAI API
        |       ├── gpt-4o          (Vision analysis + HTML generation + Chat revisor)
        |       └── gpt-image-2     (Image generation untuk placeholder assets)
        |
        |── [Image Processor — Sharp]
        |       └── Crop structural assets berdasarkan bbox koordinat dari AI
        |       └── Resize hasil generate image ke target_size
        |
        └── [Listmonk HTTP Client — Axios]
                ├── POST /api/media       (upload semua aset)
                ├── GET  /api/templates
                ├── POST /api/templates
                └── PUT  /api/templates/{id}
```

### 4.2 Tech Stack (Final — Terkunci)

| Layer | Teknologi | Keterangan |
|---|---|---|
| Frontend | **React.js + TailwindCSS** | SPA, tidak ada alternatif |
| Backend | **Node.js + Express** | Runtime langsung di VPS, tidak ada alternatif |
| Image Processing | **Sharp** | Crop structural assets + resize generated images |
| Code Editor (UI) | **Monaco Editor** | Syntax highlighting HTML, find & replace |
| AI Vision & Chat | **OpenAI `gpt-4o`** | Vision analysis (Pass 1 & 2) + Chat revisor |
| AI Image Generation | **OpenAI `gpt-image-2`** | Generate placeholder assets |
| HTTP Client (Listmonk) | **Axios** | Wrapper call ke Listmonk REST API |
| Session/Auth | **express-session + bcrypt** | Session management + password hashing |
| Config | **dotenv** | `.env` file untuk semua secrets |

### 4.3 Komponen Backend

| Komponen | Tanggung Jawab |
|---|---|
| `AuthController` | Handle login/logout, validasi session via express-session |
| `UploadController` | Terima file upload via multer, validasi format & ukuran |
| `AIOrchestrator` | Koordinasi seluruh pipeline (Pass 1 → crop/generate → upload → Pass 2) |
| `ImageProcessor` | Crop structural assets + resize generated images via Sharp |
| `OpenAIVisionClient` | Wrapper call ke `gpt-4o` untuk Pass 1 & Pass 2 |
| `OpenAIImageClient` | Wrapper call ke `gpt-image-2` untuk generate placeholder assets |
| `ListmonkClient` | Wrapper Axios untuk semua call ke Listmonk REST API |
| `ChatController` | Handle chat session, kelola conversation history, deteksi intent re-generate |

---

## 5. Fitur Detail

### 5.1 Autentikasi Sederhana

#### 5.1.1 Deskripsi

Halaman login yang melindungi seluruh aplikasi dari akses publik. Menggunakan satu akun statis yang dikonfigurasi via environment variables.

#### 5.1.2 Behaviour

- Seluruh route selain `/login` di-redirect ke halaman login jika session tidak valid
- Session berlaku selama **8 jam** atau sampai logout eksplisit
- **HTTPS wajib** — aplikasi hanya boleh diakses via HTTPS (TLS di-handle Nginx sebagai reverse proxy)
- Tidak ada fitur "lupa password" (reset manual via `.env`)
- Tidak ada rate limiting login — acceptable untuk single private user di balik HTTPS

#### 5.1.3 Konfigurasi `.env`

```env
# Auth aplikasi
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH=$2b$10$...   # bcrypt hash dari password
SESSION_SECRET=random-secret-string

# OpenAI
OPENAI_API_KEY=sk-...

# Listmonk
LISTMONK_BASE_URL=https://listmonk.example.com
LISTMONK_API_USER=api_user
LISTMONK_API_TOKEN=your-token-here
# Header yang dikirim: Authorization: token api_user:your-token-here
# Atau untuk BasicAuth fallback: LISTMONK_USE_BASIC_AUTH=true
```

#### 5.1.4 UI Spec — Halaman Login

- Form: field `Username`, field `Password` (type=password), tombol `Masuk`
- Validasi: kedua field wajib diisi (client-side)
- Error state: tampilkan pesan `"Username atau password salah"` jika auth gagal
- Tidak ada hint tentang apakah username atau password yang salah (security best practice)
- Setelah login berhasil: redirect ke halaman utama (`/`)

---

### 5.2 Upload & Image Analysis Pipeline

#### 5.2.1 Deskripsi

Alur inti aplikasi. User mengunggah satu gambar, dan sistem secara otomatis menjalankan pipeline AI multi-langkah untuk menghasilkan kode HTML siap pakai.

#### 5.2.2 Batasan File Upload

| Parameter | Nilai |
|---|---|
| Format yang didukung | JPG, JPEG, PNG |
| Ukuran maksimum | 10 MB |
| Dimensi maksimum | 5000 x 10000 px |
| Jumlah file per upload | 1 file |

#### 5.2.3 Pipeline Detail (Langkah Demi Langkah)

**Langkah 1 — Frontend Validation**
- Validasi format dan ukuran file di browser sebelum upload
- Tampilkan preview thumbnail gambar yang akan diupload

**Langkah 2 — Upload ke Backend**
- File dikirim via `multipart/form-data` ke endpoint `POST /api/process`
- Backend simpan file sementara di temp directory

**Langkah 3 — OpenAI Vision Analysis (Pass 1: Analisis & Klasifikasi)**

Backend mengirim gambar ke GPT-4o dengan prompt terstruktur. Tujuan:
- Identifikasi area teks → direproduksi sebagai HTML text nodes
- Identifikasi area gambar → klasifikasikan sebagai `structural` atau `placeholder`
- Deteksi sections dan urutan layout dari atas ke bawah
- Ekstrak **style descriptor** dari keseluruhan mockup untuk dipakai sebagai panduan image generation

**Style descriptor** adalah deskripsi singkat gaya visual dominan mockup, misalnya:
> `"flat illustration style, pastel color palette, modern minimalist, character-based, soft shadows"`

Ini dipakai di Langkah 5 sebagai bagian dari image generation prompt agar gambar yang di-generate konsisten satu sama lain.

| Kategori | Keterangan | Contoh |
|---|---|---|
| `structural` | Elemen identitas brand permanen — logo, ikon UI navigasi | Logo monday di header |
| `placeholder` | Ilustrasi / foto konten yang akan di-generate ulang oleh AI | Ilustrasi orang di step 1/2/3 |

Response yang diharapkan dari AI (JSON):
```json
{
  "style_descriptor": "flat illustration style, pastel purple and blue palette, character-based, modern minimalist",
  "image_assets": [
    {
      "id": "asset_logo",
      "type": "logo",
      "category": "structural",
      "description": "Logo monday work management di header",
      "bbox": { "x": 220, "y": 18, "width": 160, "height": 50 }
    },
    {
      "id": "asset_illustration_step1",
      "type": "illustration",
      "category": "placeholder",
      "description": "Ilustrasi orang menggunakan laptop untuk onboarding tutorial",
      "suggested_prompt": "Person using a laptop computer for an onboarding tutorial, flat illustration style, pastel purple and blue palette, character-based, modern minimalist, no text",
      "target_size": { "width": 240, "height": 180 }
    },
    {
      "id": "asset_illustration_step2",
      "type": "illustration",
      "category": "placeholder",
      "description": "Ilustrasi orang mengatur workspace dan dashboard",
      "suggested_prompt": "Person organizing a digital workspace with multiple dashboards, flat illustration style, pastel purple and blue palette, character-based, modern minimalist, no text",
      "target_size": { "width": 240, "height": 200 }
    }
  ],
  "sections": [
    { "id": "header", "label": "Header Logo" },
    { "id": "hero-text", "label": "Judul & Subtitle" },
    { "id": "step-1", "label": "Step 01 - Learn the basics" },
    { "id": "step-2", "label": "Step 02 - Organize workspace" },
    { "id": "step-3", "label": "Step 03 - Create first board" },
    { "id": "cta-primary", "label": "Tombol CTA Utama" },
    { "id": "footer", "label": "Footer & Unsubscribe" }
  ],
  "text_areas": [
    {
      "id": "text_hero",
      "content": "Build your first project",
      "detected_variables": []
    }
  ]
}
```

**Langkah 4 — Crop Aset `structural` dari Mockup**

Hanya untuk aset kategori `structural` (logo, ikon brand):
- Backend crop gambar menggunakan koordinat `bbox` dengan Sharp
- Tambahkan padding 3px di sekitar bbox
- Simpan sebagai file PNG sementara
- Jika mockup di-resize sebelumnya (lihat edge case), konversi koordinat kembali ke skala original

**Langkah 5 — Generate Gambar `placeholder` via OpenAI Image API**

Untuk setiap aset `placeholder`, backend memanggil **OpenAI Image Generation API** (model: `gpt-image-2`):

```javascript
// Contoh call per placeholder asset
const response = await openai.images.generate({
  model: "gpt-image-2",           // model final
  prompt: asset.suggested_prompt, // dari Pass 1, sudah include style_descriptor
  n: 1,
  size: "1024x1024",              // generate di resolusi tinggi, resize setelahnya
  quality: "standard"
});
// response.data[0].b64_json → decode → resize ke target_size via Sharp → simpan sementara
```

**Style consistency:** `suggested_prompt` dari Pass 1 sudah menyertakan `style_descriptor` sehingga semua generated image memiliki gaya visual yang kohesif.

**Resize setelah generate:** Gambar 1024x1024 di-resize ke `target_size` menggunakan Sharp sebelum upload ke Listmonk. Ini menjaga ukuran file tetap kecil dan proporsional dengan layout email.

**Langkah 6 — Upload Semua Aset ke Listmonk Media**

Untuk **semua aset** (baik `structural` hasil crop maupun `placeholder` hasil generate):
- Kirim `POST /api/media` ke Listmonk dengan `multipart/form-data`
- Header: `Authorization: token api_user:token`
- Simpan URL yang dikembalikan, map ke `asset_id` masing-masing

```json
// Response Listmonk POST /api/media
{
  "data": {
    "id": 42,
    "uuid": "abc-123",
    "filename": "asset_illustration_step1.png",
    "url": "https://listmonk.example.com/uploads/abc-123.png"
  }
}
```

**Langkah 7 — HTML Generation (Vision Pass 2)**

Backend kirim kembali ke GPT-4o dengan:
- Gambar original mockup (konteks visual keseluruhan)
- Hasil analisis Pass 1 (JSON lengkap)
- Map `asset_id` → URL Listmonk (untuk semua aset, structural maupun placeholder)
- System prompt khusus HTML generation (lihat bagian 5.3)

Semua `<img>` di output HTML sudah memiliki `src` URL Listmonk yang valid — tidak ada lagi `src=""` kosong dari pipeline otomatis.

**Langkah 8 — Cleanup & Response**

- Hapus semua file sementara dari temp directory (crop hasil, generate hasil)
- Kirim hasil ke frontend:
  - `html`: kode HTML lengkap
  - `detectedVariables`: list Go Template vars yang dideteksi
  - `generatedAssets`: list aset beserta URL Listmonk dan `asset_id`-nya (untuk keperluan re-generate via chat)
  - `styleDescriptor`: string gaya visual yang dideteksi (untuk dipakai jika user minta re-generate via chat)

#### 5.2.4 Re-Generate Gambar via Chat Revisor

Karena semua gambar placeholder sudah ter-generate otomatis, user mungkin ingin **mengganti** hasil generate dengan versi yang berbeda. Ini dilakukan via Chat Revisor dengan instruksi natural language:

> *"Ganti ilustrasi Step 1 dengan gambar yang lebih playful dan colorful"*
> *"Re-generate semua ilustrasi dengan style yang lebih corporate, tanpa karakter manusia"*
> *"Ganti gambar step 2 dengan: a person organizing sticky notes on a board"*

Backend mendeteksi intent "re-generate image" di pesan chat, memanggil kembali OpenAI Image API dengan prompt baru (tetap menyertakan `styleDescriptor` kecuali user secara eksplisit minta style berbeda), upload hasil ke Listmonk media, dan update `src` di HTML.

**Atribut tracking untuk re-generate:**
```html
<img
  src="https://listmonk.example.com/uploads/abc-123.png"
  data-asset-id="asset_illustration_step1"
  data-regeneratable="true"
  alt="Ilustrasi Step 1"
  width="240" height="180"
  style="display:block;"
/>
```
`data-asset-id` dipakai frontend untuk highlight gambar mana yang bisa di-re-generate, dan backend untuk mengetahui asset mana yang perlu diganti.

#### 5.2.5 Status Indikator (UI)

Pipeline ini memakan waktu **30-90 detik** (lebih lama dari sebelumnya karena ada image generation). Frontend menampilkan progress status via SSE atau polling:

| Langkah | Pesan yang Ditampilkan |
|---|---|
| 1 | `"Mengunggah gambar..."` |
| 2 | `"Menganalisis desain dan mengidentifikasi elemen..."` |
| 3 | `"Memotong aset brand dari mockup..."` |
| 4 | `"Membuat ilustrasi baru dengan AI (1/N)..."` |
| 5 | `"Mengunggah semua aset ke Listmonk..."` |
| 6 | `"Merakit kode HTML template..."` |
| 7 | `"Selesai! Template siap direview."` |

Langkah 4 menampilkan counter `(1/N)` yang update setiap satu gambar selesai di-generate, karena ini langkah terlama (setiap generate image ±5-10 detik).

---

### 5.3 AI Code Generation

#### 5.3.1 System Prompt Strategy

System prompt untuk HTML generation harus meng-instruksikan GPT-4o untuk:

1. **Format HTML**: Gunakan layout berbasis tabel (`<table>`, `<tr>`, `<td>`) bukan `<div>`. Alasan: kompatibilitas email client (terutama Outlook).
2. **CSS**: Seluruh styling menggunakan inline CSS. Tidak boleh ada `<style>` tag atau external stylesheet.
3. **Lebar**: Max-width 600px, centered, responsive untuk mobile dengan media query di `<head>` (boleh sebagai satu-satunya `<style>` tag).
4. **Gambar structural**: Gunakan URL Listmonk yang sudah di-provide. Tambahkan `alt` text deskriptif. Tambahkan `border="0"` dan `display:block`.
5. **Gambar placeholder**: Gunakan URL Listmonk hasil generate. Tambahkan atribut `data-asset-id` dan `data-regeneratable="true"` untuk keperluan re-generate via chat. Tidak ada `src=""` kosong di output final.
6. **Variabel dinamis**: Ganti semua placeholder yang terdeteksi dengan sintaks Go Template Listmonk yang sesuai.
7. **Wajib disertakan**: Link unsubscribe `{{ .UnsubscribeURL }}` di footer.
8. **Section granularity**: Setiap card/item yang repeating (contoh: step-1, step-2, step-3) harus menjadi section tersendiri dengan `data-section-id` unik. Jangan digabung. Ini memungkinkan user mereorder setiap card secara independen.
9. **Section wrapper**: Setiap section dibungkus `<table data-section-id="..." data-section-label="...">`. Section `footer` selalu di posisi paling akhir.

#### 5.3.2 Mapping Variabel Listmonk

AI diarahkan untuk mendeteksi pattern placeholder dan menggantinya:

| Pattern di Gambar | Go Template Listmonk |
|---|---|
| `$$Nama$$`, `[Nama]`, `{name}`, `Dear Customer` | `{{ .Subscriber.FirstName }}` |
| `$$Email$$`, `[email]` | `{{ .Subscriber.Email }}` |
| `[Tanggal]`, `$$Tanggal$$` | `{{ .Date }}` *(jika tersedia)* |
| Link unsubscribe (apapun bentuknya) | `{{ .UnsubscribeURL }}` |
| Link view di browser | `{{ .MessageURL }}` |

#### 5.3.3 Output Format

AI harus mengembalikan **hanya kode HTML** tanpa penjelasan tambahan, markdown code block, atau karakter lain di luar tag HTML. Backend akan mem-parse dan memvalidasi bahwa output adalah HTML valid.

---

### 5.4 Split-View Editor & AI Chat Revisor

#### 5.4.1 Layout

```
+---------------------------+---------------------------+
|   PREVIEW PANEL (kiri)    |   CODE PANEL (kanan)      |
|                           |                           |
|  [Visual Block Editor]    |  [Monaco Editor]          |
|  (drag & drop sections)   |  (editable, sync)         |
|                           |                           |
+---------------------------+---------------------------+
|          CHAT PANEL (bottom, collapsible)             |
|  [Chat history]  [Input box]  [Kirim]  [Undo]        |
+-------------------------------------------------------+
|  [Save to Listmonk]                    [Reset/Upload Baru] |
+-------------------------------------------------------+
```

#### 5.4.2 Preview Panel — Visual Block Editor

Preview bukan sekadar iframe pasif. AI saat generate HTML wajib membungkus setiap **section utama** dengan komentar penanda dan `data-section-id`:

```html
<!-- SECTION: header -->
<table data-section-id="header" data-section-label="Header"> ... </table>

<!-- SECTION: product -->
<table data-section-id="product" data-section-label="Produk Utama"> ... </table>

<!-- SECTION: cta -->
<table data-section-id="cta" data-section-label="Tombol CTA"> ... </table>

<!-- SECTION: footer -->
<table data-section-id="footer" data-section-label="Footer & Unsubscribe"> ... </table>
```

**Behaviour Drag & Drop:**
- Frontend mem-parse HTML dan memecahnya menjadi array of section objects berdasarkan `data-section-id`
- Setiap section ditampilkan sebagai **visual block** di preview panel dengan drag handle (⠿) di tepi kiri
- User bisa drag suatu block ke posisi baru
- Setelah drop: frontend menyusun ulang array sections dan merakit ulang HTML string
- Monaco Editor di-sync dengan HTML yang baru setelah reorder
- Preview auto-refresh

**Constraint drag & drop:**
- Section `footer` **tidak bisa dipindah** — selalu terkunci di posisi paling bawah (karena mengandung `{{ .UnsubscribeURL }}` yang secara best practice email harus di footer)
- Drag handle hanya muncul saat hover di atas block

#### 5.4.3 Code Editor Panel

- Menggunakan Monaco Editor dengan language mode: `html`
- Syntax highlighting aktif
- Fitur: line numbers, word wrap, find & replace
- Perubahan manual langsung merefleksikan preview (debounce 500ms)
- Perubahan manual di Monaco juga **me-reparse ulang sections** untuk drag & drop (best-effort; jika parsing gagal, drag & drop dinonaktifkan sementara dengan warning kecil)
- Tombol `Format HTML` untuk auto-format kode

#### 5.4.4 Undo (1 Level)

- State manager frontend menyimpan **satu snapshot HTML sebelumnya** (`previousHtml`)
- Snapshot disimpan setiap kali Chat Revisor berhasil melakukan revisi
- Tombol `↩ Undo` muncul di chat panel setelah AI melakukan revisi pertama
- Klik Undo: restore `previousHtml` ke Monaco Editor dan preview
- Setelah Undo, tombol Undo di-disable (hanya 1 level)
- Undo **tidak tersedia** untuk perubahan manual di Monaco Editor (hanya untuk Chat Revisor)

#### 5.4.5 AI Chat Revisor

**Behaviour:**
- Chat history disimpan di state frontend (tidak persistent antar session browser)
- Setiap pesan user dikirim ke backend bersama: pesan user + kode HTML saat ini + seluruh chat history
- Sebelum update editor, simpan snapshot HTML saat ini ke `previousHtml` (untuk Undo)
- Backend meneruskan ke OpenAI Chat Completions API
- Frontend extract kode HTML dari response, update Monaco Editor dan preview
- Tampilkan konfirmasi di chat: `"✓ Template diperbarui. Ketik ↩ Undo untuk membatalkan."`

**System Prompt untuk Chat Revisor:**
```
Kamu adalah spesialis HTML email template. Kamu akan menerima kode HTML email dan instruksi revisi dari user.

Tugasmu:
1. Analisis instruksi user
2. Lakukan perubahan minimal yang diperlukan pada HTML
3. Kembalikan HANYA kode HTML lengkap yang sudah direvisi, tanpa penjelasan, tanpa markdown, tanpa komentar

Aturan yang tidak boleh dilanggar:
- Pertahankan struktur tabel-based
- Pertahankan semua inline CSS
- Jangan hapus atau ubah variabel Go Template ({{ .Subscriber.Name }}, dll) — ini WAJIB ada
- Jangan hapus link unsubscribe {{ .UnsubscribeURL }}
- Pertahankan semua atribut data-section-id dan data-section-label pada setiap <table> section
- Pertahankan semua atribut data-asset-id dan data-regeneratable pada setiap <img> yang regeneratable
- Max width tetap 600px
- Jangan mengosongkan src="" pada <img> kecuali diminta eksplisit oleh user
```

**Conversation Context:**
Backend kirim seluruh conversation history ke OpenAI di setiap request. Batasi: jika melebihi 20 pesan, drop pesan terlama (kecuali system prompt).

---

### 5.5 Save & Listmonk Integration

#### 5.5.1 Tombol Save — Validasi Gambar

Karena semua gambar sudah di-generate otomatis oleh pipeline, **tidak ada lagi validasi placeholder kosong**. Klik tombol `"Save to Listmonk"` langsung memicu:
1. Backend memanggil `GET /api/templates` ke Listmonk
2. Frontend menampilkan modal **Template Selector**

Catatan: atribut `data-asset-id` dan `data-regeneratable` di-strip dari HTML sebelum dikirim ke Listmonk (atribut ini hanya untuk keperluan UI internal).

#### 5.5.2 Modal Template Selector

```
+--------------------------------------------+
|  Simpan Template ke Listmonk               |
|--------------------------------------------|
|  Pilih aksi:                               |
|  ( ) Update template yang sudah ada        |
|  ( ) Buat template baru                    |
|--------------------------------------------|
|  [Jika "Update":]                          |
|  Pilih template: [Dropdown list template]  |
|                                            |
|  [Jika "Buat baru":]                       |
|  Nama template: [___________________]      |
|  Tipe: [○ Standard  ○ Visual  ○ Plain Text]|
|--------------------------------------------|
|  [Batal]                    [Simpan]       |
+--------------------------------------------+
```

#### 5.5.3 Tipe Template Listmonk

| Tipe | Nilai API |
|---|---|
| Standard (HTML) | `email` |
| Visual (drag-drop) | `visual` *(biasanya tidak relevan untuk use case ini)* |
| Plain Text | `plain_text` |

Default yang dipilih: `email` (Standard).

#### 5.5.4 Logic Save

**Update existing:**
```
PUT /api/templates/{id}
Body: { "name": "...", "type": "email", "body": "<html>..." }
```

**Create new:**
```
POST /api/templates
Body: { "name": "...", "type": "email", "body": "<html>...", "is_default": false }
```

#### 5.5.5 Post-Save

- Tampilkan toast notification: `"✓ Template berhasil disimpan ke Listmonk!"`
- Modal tertutup otomatis
- State aplikasi tidak di-reset (user bisa lanjut editing atau upload baru)

---

## 6. User Flow Lengkap

```
[Start]
   |
   v
[1. Halaman Login]
   - Input: username, password
   - Error: "Username atau password salah"
   |
   v (login berhasil)
[2. Halaman Utama — Upload Area]
   - Tampil dropzone upload gambar
   - Atau klik untuk browse file
   - Validasi: format JPG/PNG, max 10MB
   |
   v (file valid, klik "Proses")
[3. Processing Screen]
   - Progress indicator dengan status text (7 langkah, dengan counter per-gambar di langkah 4)
   - Estimasi waktu: 30-90 detik
   - Tidak bisa interrupt / cancel (v1.0)
   |
   v (pipeline selesai)
[4. Split-View Review Screen]
   - Kiri: Preview iframe
   - Kanan: Monaco code editor
   - Bawah: Chat panel (collapsed by default)
   |
   +---> [4a. Edit Manual di Code Editor]
   |          - Perubahan langsung update preview
   |
   +---> [4b. Chat Revisor]
   |          - User ketik instruksi
   |          - AI update kode & preview otomatis
   |
   v (user puas, klik "Save to Listmonk")
[5. Modal Template Selector]
   - Pilih: Update existing atau Create new
   - Input nama (jika baru) atau pilih dari dropdown (jika update)
   |
   v (klik Simpan)
[6. Konfirmasi Sukses]
   - Toast notification
   - Kembali ke split-view screen
   |
   v
[End — User bisa Upload Baru atau Logout]
```

---

## 7. API Contract (Internal)

### 7.1 Authentication

#### `POST /api/auth/login`
**Request:**
```json
{ "username": "admin", "password": "plaintext_password" }
```
**Response 200:**
```json
{ "success": true }
```
**Response 401:**
```json
{ "success": false, "message": "Username atau password salah" }
```

#### `POST /api/auth/logout`
**Response 200:** `{ "success": true }`

---

### 7.2 Image Processing

#### `POST /api/process`
**Request:** `multipart/form-data`
- `file`: File gambar (JPG/PNG)

**Response 200 (jika menggunakan polling):**
```json
{ "jobId": "job_abc123", "status": "processing" }
```

#### `GET /api/process/{jobId}/status`
**Response 200:**
```json
{
  "jobId": "job_abc123",
  "status": "completed | processing | failed",
  "currentStep": 4,
  "totalSteps": 7,
  "stepMessage": "Membuat ilustrasi baru dengan AI (2/3)...",
  "result": {
    "html": "<!DOCTYPE html>...",
    "detectedVariables": ["{{ .Subscriber.FirstName }}", "{{ .UnsubscribeURL }}"],
    "styleDescriptor": "flat illustration style, pastel purple and blue palette, character-based",
    "generatedAssets": [
      { "assetId": "asset_logo", "listmonkUrl": "https://...", "category": "structural" },
      { "assetId": "asset_illustration_step1", "listmonkUrl": "https://...", "category": "placeholder" }
    ]
  }
}
```

---

### 7.3 Chat Revisor

#### `POST /api/chat/revise`
**Request:**
```json
{
  "userMessage": "Ubah tombol menjadi warna merah",
  "currentHtml": "<!DOCTYPE html>...",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
**Response 200:**
```json
{
  "revisedHtml": "<!DOCTYPE html>...",
  "assistantMessage": "✓ Template diperbarui. Warna tombol sudah diubah menjadi merah."
}
```

---

### 7.4 Listmonk Integration

#### `GET /api/listmonk/templates`
Proxy ke Listmonk `GET /api/templates`. Return list template.

**Response 200:**
```json
{
  "templates": [
    { "id": 1, "name": "Promo Bulanan", "type": "email" },
    { "id": 2, "name": "Welcome Email", "type": "email" }
  ]
}
```

#### `POST /api/listmonk/templates/save`
**Request:**
```json
{
  "action": "create | update",
  "templateId": 1,
  "templateName": "Promo Mei 2026",
  "templateType": "email",
  "html": "<!DOCTYPE html>..."
}
```
**Response 200:**
```json
{ "success": true, "templateId": 5, "templateName": "Promo Mei 2026" }
```

---

## 8. Data Model

### 8.1 Session

Disimpan di server-side session store (in-memory atau file-based).

```
Session {
  userId: string         // selalu "admin" untuk single-user
  createdAt: timestamp
  expiresAt: timestamp   // createdAt + 8 jam
}
```

### 8.2 Processing Job (In-Memory)

```
Job {
  jobId: string (UUID)
  status: "pending" | "processing" | "completed" | "failed"
  currentStep: number (1-7)       // mengikuti 7 langkah UI di section 5.2.5
  stepMessage: string
  imageGenProgress: { current: number, total: number } | null  // hanya aktif di langkah 4
  tempFilePaths: string[]          // untuk cleanup — hapus semua saat job selesai atau TTL 10 menit
  result: {
    html: string
    detectedVariables: string[]
    styleDescriptor: string
    generatedAssets: Asset[]
  }
  error: string | null
  createdAt: timestamp
}
```

### 8.3 Asset

```
Asset {
  assetId: string
  category: "structural" | "placeholder"
  type: "logo" | "illustration" | "screenshot" | "icon" | "banner"
  description: string
  bbox: { x, y, width, height } | null   // hanya untuk structural; null untuk placeholder
  suggestedPrompt: string | null          // hanya untuk placeholder
  targetSize: { width, height }
  tempFilePath: string                    // path file sementara sebelum upload
  listmonkMediaId: number | null
  listmonkUrl: string | null
}
```

---

## 9. Error Handling & Edge Cases

### 9.1 Error Scenarios

| Skenario | Pesan untuk User | Aksi Sistem |
|---|---|---|
| File bukan JPG/PNG | `"Format tidak didukung. Gunakan JPG atau PNG."` | Tolak di client-side |
| File > 10MB | `"Ukuran file terlalu besar. Maksimum 10MB."` | Tolak di client-side |
| OpenAI Vision API error | `"Gagal menganalisis gambar. Coba lagi dalam beberapa saat."` | Log error, return 500 |
| OpenAI Image Generation gagal (satu aset) | Warning ringan di preview per gambar yang gagal | Skip aset, lanjutkan pipeline, badge ⚠️ di preview |
| OpenAI Image Generation gagal (semua aset) | `"Gagal membuat ilustrasi. Coba lagi."` | Log error, abort pipeline |
| Listmonk tidak dapat dijangkau | `"Tidak dapat terhubung ke Listmonk. Periksa konfigurasi server."` | Log error, return 503 |
| Listmonk upload media gagal | `"Gagal mengunggah aset gambar ke Listmonk."` | Log error, restart dari awal |
| OpenAI tidak mengembalikan HTML valid | `"AI gagal menghasilkan kode yang valid. Coba lagi."` | Retry 1x, jika gagal return error |
| Template tidak ditemukan saat update | `"Template tidak ditemukan di Listmonk."` | Return 404 ke frontend |

### 9.2 Edge Cases

**Semua gambar diklasifikasikan sebagai `placeholder` (tidak ada yang structural):**
- Pipeline lanjut tanpa langkah crop sama sekali
- Semua gambar di-generate via OpenAI Image API
- Normal flow, tidak ada penanganan khusus

**AI salah mengklasifikasi logo sebagai `placeholder` (lalu di-generate ulang):**
- Hasil generate mungkin tidak sesuai (logo brand tidak bisa di-generate ulang dengan akurat)
- User bisa perbaiki via chat: *"Ganti gambar header dengan URL logo asli ini: https://..."*
- Chat Revisor update `src` di HTML

**Image generation gagal untuk salah satu aset:**
- Log error, skip aset tersebut
- Generate HTML tetap dilanjutkan; `<img>` yang gagal di-generate menggunakan `src=""` dengan background fallback abu-abu dan badge "⚠️ Gagal di-generate — ganti via chat"
- Tampilkan warning ke user setelah selesai

**AI gagal mendeteksi bounding box structural asset dengan akurat:**
- Crop area diberi margin +10% di setiap sisi
- Fallback: jika hasil crop terlalu kecil (< 20x20px), skip crop dan gunakan image generation sebagai pengganti

**Gambar sangat besar (misal: 5000px tinggi):**
- Resize gambar ke max 1500px width sebelum kirim ke OpenAI (OpenAI punya batas ukuran)
- Gunakan faktor skala untuk konversi koordinat bbox kembali ke ukuran original

**Listmonk media upload berhasil sebagian (sebagian aset gagal upload):**
- Aset yang gagal upload: generate HTML tetap dilanjutkan, `<img>` yang bersangkutan menggunakan `src=""` dengan background fallback abu-abu dan badge ⚠️ di preview (sama seperti error image generation)
- Tampilkan warning ke user setelah pipeline selesai: `"Beberapa aset gagal diupload ke Listmonk. Ganti via Chat Revisor sebelum menyimpan."`
- Catatan: ini adalah satu-satunya kondisi di mana `src=""` bisa muncul di output — bukan kondisi normal

---

## 10. Kebutuhan Non-Fungsional

### 10.1 Keamanan

| Aspek | Implementasi |
|---|---|
| Transport | **HTTPS wajib** via Nginx reverse proxy + TLS certificate |
| Credentials storage | Semua secrets di `.env`, tidak pernah expose ke frontend |
| API key OpenAI | Hanya di backend, tidak pernah ada di response ke frontend |
| Listmonk credentials | Token `api_user:token` disimpan di `.env`, dikirim via `Authorization: token` header — tidak pernah expose ke frontend |
| Session security | HttpOnly cookie, Secure flag (aktif karena HTTPS), SameSite=Strict |
| Session TTL | 8 jam, auto-expired |
| File upload security | Validasi MIME type (bukan hanya ekstensi), scan magic bytes |
| Temp file cleanup | Hapus file sementara setelah job selesai atau timeout 10 menit |
| Input sanitization | Sanitasi nama template sebelum dikirim ke Listmonk API |

### 10.2 Performa

| Aspek | Target |
|---|---|
| Total pipeline waktu | 30–90 detik (lebih lama karena image generation: ±5-10 detik per gambar) |
| Frontend responsiveness | UI tidak frozen selama processing (async) |
| Preview refresh debounce | 500ms setelah edit terakhir |
| Ukuran bundle frontend | < 2MB (termasuk Monaco Editor) |

### 10.3 Reliability

- Retry otomatis 1x jika OpenAI API call gagal (dengan exponential backoff kecil)
- Temp file cleanup berjalan via job TTL, bukan hanya saat request selesai
- Validasi HTML output dari AI sebelum dikirim ke frontend (cek minimal: `<html`, `<body`, ada konten)

### 10.4 UX & Accessibility

- Loading state yang jelas di setiap tahap pipeline
- Semua tombol punya state disabled saat proses berjalan
- Pesan error yang actionable (bukan sekadar kode error)
- Mobile-friendly untuk halaman login (minimal); main app boleh desktop-only

---

## 11. Acceptance Criteria

### AC-01: Login
- [ ] User dapat login dengan kredensial yang benar
- [ ] Login gagal menampilkan pesan error yang tepat (tanpa hint username/password)
- [ ] Route selain `/login` redirect ke login jika belum auth

### AC-02: Upload & Pipeline
- [ ] File JPG dan PNG berhasil diupload
- [ ] File dengan format selain JPG/PNG ditolak dengan pesan error yang jelas
- [ ] File > 10MB ditolak dengan pesan error yang jelas
- [ ] Progress status tampil dengan 7 langkah dan counter image generation `(1/N)`

### AC-03: HTML Generation
- [ ] HTML yang dihasilkan valid dan dapat dirender di browser
- [ ] HTML menggunakan struktur tabel (bukan div)
- [ ] Setiap section utama dibungkus dengan `data-section-id` dan `data-section-label` yang benar
- [ ] Repeating cards (step-1, step-2, dst) masing-masing jadi section tersendiri
- [ ] Aset `structural` (logo, ikon brand) di-crop dari mockup, diupload ke Listmonk, URL ter-embed di HTML
- [ ] Aset `placeholder` (ilustrasi, foto konten) di-generate via OpenAI Image API dengan style konsisten, diupload ke Listmonk, URL ter-embed di HTML
- [ ] Semua `<img>` memiliki `src` URL Listmonk yang valid — tidak ada `src=""` kosong
- [ ] Gambar hasil generate memiliki atribut `data-asset-id` dan `data-regeneratable="true"`
- [ ] Variabel Go Template terdeteksi dan diinsert dengan benar di setiap template
- [ ] `{{ .UnsubscribeURL }}` selalu ada di section footer

### AC-04: Preview Panel & Re-Generate UX
- [ ] Preview panel memecah HTML menjadi visual blocks berdasarkan `data-section-id`
- [ ] Gambar dengan `data-regeneratable="true"` menampilkan badge "🔄 Re-generate" saat hover
- [ ] Drag & drop block berhasil mereorder section di preview dan Monaco Editor
- [ ] Section `footer` terkunci — tidak bisa dipindah dari posisi bawah
- [ ] Perubahan di Monaco Editor merefleksikan preview dengan debounce 500ms
- [ ] Toggle mobile (320px) / desktop (600px) view berfungsi
- [ ] Tombol `Format HTML` berfungsi

### AC-05: Chat Revisor & Undo
- [ ] Instruksi re-generate gambar berhasil: gambar baru di-generate, upload ke Listmonk, `src` di HTML terupdate
- [ ] Style descriptor dipertahankan saat re-generate kecuali user minta style berbeda
- [ ] Instruksi styling (warna, font, padding) berhasil direvisi tanpa mengganggu gambar
- [ ] Variabel Go Template tidak hilang setelah revisi
- [ ] `data-section-id` dan `data-asset-id` attributes tidak hilang setelah revisi AI
- [ ] Tombol Undo muncul setelah AI melakukan revisi pertama
- [ ] Klik Undo mengembalikan ke versi HTML sebelumnya (termasuk gambar lama)
- [ ] Setelah Undo, tombol Undo di-disable
- [ ] History chat dipertahankan dalam satu session

### AC-06: Save ke Listmonk
- [ ] Atribut `data-asset-id` dan `data-regeneratable` di-strip dari HTML sebelum dikirim ke Listmonk
- [ ] Daftar template existing tampil dengan benar dari Listmonk
- [ ] Create template baru berhasil dan muncul di Listmonk
- [ ] Update template existing berhasil menimpa konten yang lama
- [ ] Toast notifikasi sukses/gagal tampil dengan benar

---

## 12. Open Questions & Asumsi

### 12.1 Open Questions

**Semua open questions telah terselesaikan.** FSD ini dianggap final.

### 12.2 Keputusan yang Sudah Dikonfirmasi

| # | Keputusan |
|---|---|
| D-1 | Input selalu full mockup email dari header sampai footer — bukan per-section |
| D-2 | Aset `structural` (logo/ikon brand) → crop dari mockup + upload Listmonk. Aset `placeholder` (ilustrasi/foto konten) → **generate via OpenAI Image API** dengan style konsisten + upload Listmonk. Tidak ada `src=""` kosong. |
| D-3 | Repeating cards (step-1, step-2, dst) masing-masing jadi section tersendiri yang bisa di-drag |
| D-4 | Error pipeline → restart dari awal, tidak ada partial retry |
| D-5 | Undo: 1 level saja, hanya untuk perubahan dari Chat Revisor |
| D-6 | Drag & drop: reorder visual blocks di preview panel, footer terkunci di bawah |
| D-7 | Variabel Go Template wajib ada di setiap template — deteksi harus selalu aktif |
| D-8 | Deployment: bare Node.js di VPS, tanpa Docker |
| D-9 | Frekuensi rendah (1–5x/minggu) → in-memory job store cukup, tidak perlu Redis |
| D-10 | Keamanan: HTTPS + session (HttpOnly, Secure, SameSite=Strict) — sudah cukup |
| D-11 | Listmonk Auth: `Authorization: token api_user:token` header sebagai default; BasicAuth sebagai fallback |
| D-12 | Image generation model: **`gpt-image-2`** (final, tidak ada fallback); style descriptor dari Pass 1 dipakai untuk konsistensi visual antar gambar |
| D-13 | Re-generate gambar via Chat Revisor: natural language → backend deteksi intent → generate ulang → upload → update `src` |

### 12.3 Asumsi Teknis

| # | Asumsi |
|---|---|
| A-1 | Nginx digunakan sebagai reverse proxy yang handle TLS termination |
| A-2 | VPS memiliki Node.js 18+ terinstall |
| A-3 | Listmonk instance sudah running dan accessible dari VPS yang sama atau via jaringan internal |
| A-4 | Koneksi ke OpenAI API stabil; intermittent failures ditangani dengan 1x retry |
| A-5 | Gambar mockup sudah dalam resolusi cukup untuk crop yang layak (min 600px wide) |
| A-6 | API user dan token Listmonk dibuat terlebih dahulu di Admin → Users sebelum aplikasi di-deploy |
| A-7 | OpenAI account memiliki akses ke `gpt-image-2` image generation API |

---

*Last updated: 3 Mei 2026 — v2.2 Final (post-review pass)*
