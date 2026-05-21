# Aturan 1: Wajib Membaca docs/specs.md Sebelum Coding
## Deskripsi
Wajib membaca docs/specs.md terlebih dahulu untuk memahami garis besar, konteks, dan struktur proyek sebelum melakukan perubahan apa pun.


# Aturan 2: Akses Dokumentasi dan cari Informasi menggunakan MCP Context7/Firecrawl ataupun web search Sebelum Menjalankan Kode

## Deskripsi
Apabila saat mau eksekusi atau implementasi kode apa pun tetapi kamu bingung dan tidak paham tentang dokumentasi implementasi suatu pustaka ataupun penulisan kode, konsultasikan terlebih dahulu dengan MCP server Context7 atau MCP Firecrawl untuk mengakses dokumentasi dan contoh kode terbaru dari pustaka dan framework yang relevan. Hal ini memastikan bahwa implementasi didasarkan pada praktik terbaik terkini dan penggunaan API yang akurat.



# Aturan 3 : Manajemen Berkas & Sistem

- Hindari operasi destruktif seperti `rm -rf`; gunakan alternatif yang lebih aman seperti `trash`
- Jangan gunakan `sudo` kecuali benar-benar diperlukan. Jika perlu, minta pengguna untuk menjalankan `sudo` di jendela terminal terpisah
- Setelah melakukan operasi, simpan log perubahan atau ringkasan perubahan dalam berkas markdown di docs/changelog.md
- Selalu simpan dokumentasi dalam berkas markdown di /docs, DILARANG KERAS dan JANGAN PERNAH meletakan dokumetasi di direktori utama (root)


# Aturan 3 : Membuat UI mengacu pada design-system
## Deskripsi
Untuk membuat UI harus selalu mengacu pada best practice dan standar industri, pastikan design konsisten di semua halaman termasuk dengan animasinya.


# Auran 5: Kualitas & Standar Kode
## Ikuti prinsip-prinsip berikut dalam setiap kode yang kamu generate:

- Clean Code: Tulis kode yang mudah dibaca dan dipahami
- SOLID Principles: Terapkan Single Responsibility, jangan buat function yang melakukan terlalu banyak hal
- DRY (Don't Repeat Yourself): Hindari duplikasi kode, buat reusable functions
- Gunakan naming convention yang konsisten (camelCase untuk variabel/function, PascalCase untuk class)
- Tambahkan error handling yang proper
- Tulis komentar hanya untuk logika yang kompleks, bukan yang sudah jelas
- Pecah fungsi monolitik yang besar menjadi fungsi-fungsi yang lebih kecil dan dapat digunakan kembali
- Hapus kode yang dikomentari dari versi final; jika kode tidak diperlukan, hapus saja
- Tangani peringatan linting dan pemformatan dengan segera

Code Convention:
- Gunakan 2 spasi untuk indentasi
- Gunakan single quotes untuk string
- Tambahkan semicolon di akhir statement
- Gunakan async/await instead of promises chains
- Tulis JSDoc untuk function yang exported



# Aturan 6: Dependensi & Pustaka

- Gunakan hanya pustaka yang stabil dan terpelihara dengan baik
- Hindari pustaka yang sudah usang (deprecated), kedaluwarsa, eksperimental, atau versi beta
- Jaga agar dependensi tetap mutakhir dengan versi stabil terbaru

# Aturan 7: Keamanan & Konfigurasi

- JANGAN PERNAH dan DILARANG KERAS menyertakan informasi sensitif (kunci API, kata sandi, data pribadi) secara hardcode
- Gunakan berkas konfigurasi atau variabel lingkungan misal seperti .env alih-alih nilai yang ditulis langsung (hardcoded)

# Aturan 8 : Selalu Buat Checkpoint Setelah Menyelesaikan Tugas dan update progress serta Menyelesaikan Fitur atau perbaikan selalu akhiri dengan commit .git

## Deskripsi
Setelah menyelesaikan suatu tugas atau mencapai tonggak penting, selalu buat checkpoint dengan memperbarui daftar tugas (todo list). Hal ini memastikan pelacakan kemajuan dan memungkinkan rollback (kembali ke kondisi sebelumnya) jika diperlukan. Jangan membuat dokumentasi apapun setelah setiap menyelesaikan tugas, kamu hanya membuat dokumentasi apabila di minta secara explicit oleh pengguna.

## Pedoman

- **Checkpoint Penyelesaian Tugas**: Saat tugas selesai, perbarui daftar tugas dengan status “selesai” dan sampaikan ringkasan ke pengguna mengenai apa yang telah dicapai dan juga mengupdate docs/task.md
- **Dokumentasi Tonggak**: Untuk tugas kompleks dengan beberapa langkah, buat checkpoint pada titik-titik logis untuk melacak kemajuan.
- **Pelestarian Kondisi**: Pastikan semua perubahan tersimpan dengan benar dan proyek berada dalam kondisi berfungsi sebelum menandai tugas sebagai selesai.
- **Integrasi dengan Alur Kerja**: Jadikan pembuatan checkpoint sebagai bagian standar dari setiap penyelesaian tugas.
- **Commit dan Push ke GitHub**: Setelah menyelesaikan fitur atau perbaikan, selalu lakukan commit pada repository git lokal.


# Aturan 9: Wajib Memperbarui specs.md Saat Struktur/Fitur Berubah
## Deskripsi
Setiap perubahan struktur folder atau penambahan fitur wajib diikuti pembaruan docs/specs.md agar tetap konsisten dan update dengan kondisi proyek terbaru.


