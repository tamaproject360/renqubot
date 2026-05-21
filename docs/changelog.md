# Changelog

## 2026-05-21

- Menambahkan Config Platform Phase 2 di backend Bun dengan schema Zod untuk AI provider, database, spreadsheet, WhatsApp whitelist, dan service account path.
- Menambahkan endpoint `GET/PATCH/POST /api/config`, `PATCH /api/config/secrets`, dan `POST /api/config/google-service-account` dengan response envelope konsisten.
- Menambahkan penyimpanan konfigurasi parsial, metadata secret masked, audit log JSONL, dan penyimpanan credential Google di direktori terkontrol.
- Refactor `src/config.ts` agar tidak melakukan `process.exit` saat import; validasi runtime kini dilakukan eksplisit di startup pipeline.
- Menghapus top-level throw pada modul AI agar import module tidak fatal sebelum runtime memproses pesan.
- Menambahkan tabel SQLite `schema_migrations`, `app_config`, `app_secrets_meta`, dan `app_audit_logs` untuk evolusi config platform.
- Menambahkan ignore Git untuk `data/config` dan `data/credentials` agar konfigurasi lokal dan secret tidak ikut ter-commit.
- Menambahkan fondasi monorepo ringan dengan workspace `apps/*` dan `services/*`.
- Menambahkan frontend terpisah `apps/web` berbasis Next.js App Router + TypeScript.
- Menambahkan backend terpisah `services/api` berbasis Bun dengan endpoint awal `/health`, `/ready`, dan `/api/system/status`.
- Menambahkan kontrak status sistem dan setup state untuk integrasi frontend-backend fase awal.
- Memperbarui `docs/specs.md` untuk mencerminkan struktur frontend/backend terpisah dan command baru.
- Memperbarui `docs/task.md` dengan status DONE untuk beberapa task Phase 1 yang sudah dibangun.
