# Changelog

## 2026-05-21

- Menambahkan fondasi monorepo ringan dengan workspace `apps/*` dan `services/*`.
- Menambahkan frontend terpisah `apps/web` berbasis Next.js App Router + TypeScript.
- Menambahkan backend terpisah `services/api` berbasis Bun dengan endpoint awal `/health`, `/ready`, dan `/api/system/status`.
- Menambahkan kontrak status sistem dan setup state untuk integrasi frontend-backend fase awal.
- Memperbarui `docs/specs.md` untuk mencerminkan struktur frontend/backend terpisah dan command baru.
- Memperbarui `docs/task.md` dengan status DONE untuk beberapa task Phase 1 yang sudah dibangun.
