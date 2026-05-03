# Setup Guide — Listmonk Template Generator

## Prasyarat

- Node.js 18+
- Listmonk instance yang sudah running
- OpenAI API key dengan akses ke `gpt-4o` dan `gpt-image-1`

---

## 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 2. Konfigurasi Environment Backend

```bash
cd backend
cp .env.example .env
```

Edit file `.env`:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH=       # Generate dengan: node generate-hash.js passwordAnda
SESSION_SECRET=           # Random string panjang, misal: openssl rand -hex 32
OPENAI_API_KEY=sk-...
LISTMONK_BASE_URL=https://listmonk.example.com
LISTMONK_API_USER=api_user
LISTMONK_API_TOKEN=your-token
PORT=3001
NODE_ENV=production
```

### Generate Password Hash

```bash
cd backend
node generate-hash.js passwordAnda
# Salin output ke AUTH_PASSWORD_HASH di .env
```

---

## 3. Build Frontend (Produksi)

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

---

## 4. Jalankan Backend (Produksi)

```bash
cd backend
npm start
# Server berjalan di http://localhost:3001
# Frontend static files di-serve dari frontend/dist/
```

---

## 5. Konfigurasi Nginx (Reverse Proxy)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Upload file max 15MB (lebih dari batas 10MB untuk headroom)
    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;

        # Timeout lebih lama untuk AI pipeline (bisa 90 detik)
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}

# Redirect HTTP ke HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 6. Development Mode (Lokal)

Jalankan backend dan frontend secara terpisah:

```bash
# Terminal 1: Backend
cd backend
npm run dev     # nodemon, hot reload

# Terminal 2: Frontend
cd frontend
npm run dev     # Vite dev server dengan proxy ke backend:3001
```

Buka: http://localhost:5173

---

## Struktur Project

```
ListMonkDesignGenerator/
├── FSD/
│   └── fsd_listmonk_generator.md
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express entry point
│   │   ├── controllers/
│   │   │   ├── authController.js     # Login/logout
│   │   │   ├── uploadController.js   # File upload + polling
│   │   │   └── chatController.js     # Chat revisor AI
│   │   ├── services/
│   │   │   ├── aiOrchestrator.js     # Pipeline 8-langkah + job store
│   │   │   ├── imageProcessor.js     # Sharp crop/resize
│   │   │   ├── openaiVisionClient.js # GPT-4o Vision + Chat
│   │   │   ├── openaiImageClient.js  # gpt-image-1 generation
│   │   │   └── listmonkClient.js     # Listmonk API wrapper
│   │   ├── middleware/
│   │   │   └── auth.js               # Session auth middleware
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── process.js
│   │       ├── chat.js
│   │       └── listmonk.js
│   ├── temp/                         # Auto-created, temp files
│   ├── generate-hash.js              # Password hash utility
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── LoginPage.jsx         # Glassmorphism login
    │   │   ├── UploadPage.jsx        # Drag & drop upload
    │   │   ├── ProcessingScreen.jsx  # 7-step progress
    │   │   ├── EditorPage.jsx        # Split-view editor
    │   │   ├── SaveModal.jsx         # Template selector
    │   │   ├── editor/
    │   │   │   ├── PreviewPanel.jsx  # Drag & drop sections
    │   │   │   ├── CodeEditorPanel.jsx # Monaco Editor
    │   │   │   └── ChatPanel.jsx     # AI chat revisor
    │   │   └── shared/
    │   │       └── Toast.jsx
    │   ├── context/
    │   │   └── AppContext.jsx        # Global state
    │   ├── App.jsx                   # Root + auth check
    │   └── index.css                 # Dark theme + animations
    └── package.json
```

---

## Keamanan

- Session 8 jam, HttpOnly + Secure + SameSite=Strict
- Password di-hash dengan bcrypt (cost factor 10)
- Semua secrets di `.env`, tidak pernah expose ke frontend
- File upload: validasi MIME type + magic bytes
- Temp files: auto-cleanup setelah pipeline selesai (TTL 10 menit)
- Input sanitasi sebelum dikirim ke Listmonk API
