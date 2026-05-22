# Production Deployment

Panduan ini menjalankan Renqu Bot dengan Docker Compose untuk percobaan production di server pribadi.

## Service

- `renqubot-api`: Bun backend API di port `3001`, termasuk kontrol bot runtime WhatsApp.
- `renqubot-web`: Next.js admin frontend di port `3000`.
- `./data:/app/data`: volume persisten untuk SQLite, konfigurasi, secrets metadata, Google credential, dan status runtime WhatsApp.

## Persiapan Server

1. Install Docker dan Docker Compose plugin.
2. Clone repository ke server.
3. Buat file environment production:

```bash
cp .env.production.example .env.production
```

4. Edit `.env.production`, terutama:

```bash
NEXT_PUBLIC_API_BASE_URL=http://YOUR_SERVER_IP:3001
API_CORS_ORIGIN=http://YOUR_SERVER_IP:3000
AI_PROVIDER=openai-compatible
CUSTOM_BASE_URL=https://token.tamadev.cloud/v1
CUSTOM_MODEL=gpt-5.4-mini
CUSTOM_API_KEY=isi_api_key
SPREADSHEET_ID=isi_spreadsheet_id
SHEET_NAME=catatan
ALLOWED_USER_IDS=628xxxxxxxxxx
```

Jika memakai domain dan reverse proxy, ganti `NEXT_PUBLIC_API_BASE_URL` dan `API_CORS_ORIGIN` ke URL publik yang sesuai.

## Jalankan

```bash
docker compose --env-file .env.production up -d --build
```

Buka frontend:

```text
http://YOUR_SERVER_IP:3000
```

Buka API health:

```text
http://YOUR_SERVER_IP:3001/health
```

## Google Service Account

Ada dua opsi:

- Upload lewat halaman Setup di admin UI.
- Simpan manual ke `data/credentials/google-service-account.json`, lalu pastikan `GCLOUD_KEY_PATH=/app/data/credentials/google-service-account.json`.

## Operasional

Lihat log:

```bash
docker compose logs -f api
docker compose logs -f web
```

Restart service:

```bash
docker compose restart api
docker compose restart web
```

Stop service:

```bash
docker compose down
```

Jangan hapus folder `data` jika ingin mempertahankan database, konfigurasi, credential, dan sesi WhatsApp.
