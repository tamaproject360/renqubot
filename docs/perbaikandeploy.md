# Perbaikan Deploy Renqu Bot

Dokumen ini mencatat perbaikan yang ditemukan saat deploy production agar bisa diterapkan permanen ke source code lokal.

## Ringkasan Masalah

Deploy awal memakai Docker Compose dari repository `tamaproject360/renqubot` dengan image `oven/bun:1.2.15-slim`. Container API dan Web berhasil build, tetapi diagnostics database gagal karena `Bun.SQL` di image tersebut belum mendukung adapter SQLite untuk URL `file:` atau `sqlite:`.

Error yang muncul:

```text
Unsupported adapter: file. Only "postgres" is supported for now
Unsupported adapter: sqlite. Only "postgres" is supported for now
```

Saat image dinaikkan ke `oven/bun:1.3.3-slim`, dependency workspace tidak lagi seluruhnya tersedia di root `node_modules`. Akibatnya API gagal menemukan `zod`, dan Web build sempat gagal menemukan `next`.

## Perbaikan Yang Diterapkan Di Server

Lokasi server:

```text
/opt/renqubot
```

Perubahan runtime Docker:

```diff
- FROM oven/bun:1.2.15-slim AS deps
+ FROM oven/bun:1.3.3-slim AS deps
```

Perubahan ini diterapkan pada:

```text
Dockerfile.api
Dockerfile.web
```

Perubahan dependency workspace di `Dockerfile.api`:

```diff
 COPY --from=deps /app/node_modules ./node_modules
+COPY --from=deps /app/services/api/node_modules ./services/api/node_modules
```

Perubahan dependency workspace di `Dockerfile.web`:

```diff
 COPY --from=deps /app/node_modules ./node_modules
+COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
```

Database URL production diubah dari format lama:

```text
file:./data/baileys.db
```

Menjadi format SQLite eksplisit:

```text
sqlite://./data/baileys.db
```


## Patch Yang Disarankan Untuk Source Lokal

1. Naikkan base image di `Dockerfile.api` dan `Dockerfile.web` ke Bun stabil yang mendukung SQLite `Bun.SQL`, minimal `oven/bun:1.3.3-slim`.
2. Salin dependency workspace dari stage `deps` ke stage runtime/builder:
   - `services/api/node_modules` untuk API.
   - `apps/web/node_modules` untuk Web.
3. Ubah default production database URL di `.env.production.example` menjadi `sqlite://./data/baileys.db`.
4. Pertimbangkan update default `database.url` di schema/config agar format SQLite eksplisit dipakai untuk deployment Bun terbaru.
5. Build ulang dengan `docker compose --env-file .env.production up -d --build`.
