# Release Plan Bertahap

Dokumen ini merangkum milestone implementasi Phase 10 agar delivery tetap berurutan dan tidak melompat ke fitur analitik sebelum setup MVP stabil.

## Milestone 1: Foundation Backend

Status: Done

Fokus:

- Config Platform dengan schema validasi terpusat.
- Backend API terpisah berbasis Bun.
- Health, readiness, diagnostics, dan response envelope standar.
- Runtime bridge untuk status WhatsApp dan QR.
- Database abstraction awal untuk SQLite.

## Milestone 2: Setup GUI MVP

Status: Done untuk fondasi UI, In Progress untuk integrasi penuh semua form.

Fokus:

- Next.js admin console di `apps/web`.
- Sidebar biru collapsible dan main workspace putih.
- Halaman inti: Dashboard, Setup, Integrations, WhatsApp, Transactions, System.
- Save config draft, diagnostics trigger, dan polling status WhatsApp.

## Milestone 3: Operational Dashboard

Status: In Progress

Fokus:

- Dashboard health yang membaca status real-time backend.
- Queue sinkronisasi Spreadsheet untuk kegagalan integrasi eksternal.
- Observability, retry worker, dan status job operasional.

## Deferred Sampai MVP Stabil

- Edit transaksi manual.
- Multi-user admin.
- Analytics lanjutan.
- Koreksi transaksi dari GUI.
