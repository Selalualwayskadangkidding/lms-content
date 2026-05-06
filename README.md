# Dokumentasi LMS Assessment

## Ringkasan

Proyek ini adalah aplikasi assessment sederhana berbasis PHP tanpa framework. Tampilan dirender di server, autentikasi dan penyimpanan data memakai Supabase, sedangkan session PHP dipakai untuk menjaga login pengguna.

Di kode saat ini, penyebutan role aplikasinya adalah:

- `user` = `STUDENT`
- `admin` = `TEACHER`

Jadi ketika membahas alur `admin`, implementasi nyatanya ada di halaman-halaman `teacher`.

## Analisa Struktur Folder

```text
lms-content/
|-- assets/
|   `-- style.css
|-- public/
|   |-- index.php
|   |-- auth-login.php
|   |-- auth-register.php
|   |-- auth-forgot.php
|   |-- auth-reset.php
|   |-- auth-confirm.php
|   |-- logout.php
|   |-- admin/
|   |   |-- teacher.php
|   |   |-- teacher-assessment-new.php
|   |   |-- teacher-assessment-edit.php
|   |   |-- teacher-assessment-results.php
|   |   |-- teacher-assessment-attempt.php
|   |   `-- teacher-assessment-delete.php
|   `-- member/
|       |-- student.php
|       |-- student-assessment.php
|       |-- student-attempt.php
|       `-- student-attempt-result.php
|-- src/
|   `-- bootstrap.php
|-- .env
`-- index.php
```

### Fungsi Tiap Folder

- `assets/`
  Menyimpan stylesheet global untuk halaman auth, dashboard student, dashboard admin, kartu assessment, tabel hasil, dan halaman detail attempt.

- `public/`
  Menjadi area route utama aplikasi. Semua halaman yang diakses browser ada di folder ini.

- `public/admin/`
  Area khusus `admin/teacher` untuk membuat, mengedit, menghapus assessment, melihat hasil siswa, memberi evaluasi, dan mereset attempt siswa.

- `public/member/`
  Area khusus `user/student` untuk melihat assessment yang tersedia, memulai attempt, mengerjakan soal, melihat nilai, serta menerima feedback dari guru.

- `src/`
  Menyimpan bootstrap aplikasi dan helper inti:
  memuat `.env`, memulai session, membungkus request ke Supabase, validasi role, helper waktu, upload foto profil, perhitungan skor, dan agregasi hasil attempt.

- `index.php`
  Redirect dari root proyek ke folder `public/`.

## Cara Menjalankan

### 1. Prasyarat

- PHP 8.1 atau lebih baru
- Web server lokal seperti Laragon/Apache
- Extension PHP `curl`
- Extension PHP `fileinfo`
- Akses ke project Supabase

Tidak ada step build `npm`, `composer`, atau migration lokal di repo ini. Aplikasi langsung berjalan sebagai PHP server-rendered biasa.

### 2. Konfigurasi `.env`

File `.env` saat ini memakai key berikut:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_TZ=Asia/Jakarta
```

Keterangan:

- `SUPABASE_URL`: URL project Supabase
- `SUPABASE_ANON_KEY`: dipakai untuk request auth dan request data biasa
- `SUPABASE_SERVICE_ROLE_KEY`: dipakai untuk operasi admin/server seperti membuat user, reset password admin-side, upload foto, dan reset attempt
- `APP_TZ`: timezone aplikasi, default `Asia/Jakarta`

### 3. Kebutuhan Data di Supabase

Berdasarkan query di kode, aplikasi ini mengandalkan tabel dan bucket berikut:

- `roles`
- `profiles`
- `subjects`
- `assessments`
- `questions`
- `options`
- `answer_keys`
- `attempts`
- `responses`
- `teacher_feedback`
- bucket storage publik `profiles`

Data minimum yang harus ada:

- tabel `roles` harus punya role `STUDENT` dan `TEACHER`
- bucket `profiles` harus tersedia untuk upload foto profil

### 4. Menjalankan di Laragon

1. Letakkan proyek di web root, misalnya `C:\laragon\www\lms-content`
2. Isi file `.env`
3. Jalankan Laragon
4. Buka:

```text
http://localhost/lms-content/
```

Root proyek akan otomatis redirect ke `public/`.

### 5. Alternatif Menjalankan dengan PHP Built-in Server

Jalankan dari root proyek:

```powershell
php -S localhost:8000
```

Lalu buka:

```text
http://localhost:8000/
```

### 6. Menyiapkan Akun

- Akun `student/user` bisa dibuat dari halaman register.
- Akun `admin/teacher` tidak dibuat dari UI register, karena `auth-register.php` selalu membuat user dengan role `STUDENT`.

Artinya akun admin perlu disiapkan manual di Supabase:

- buat user auth
- isi metadata atau profile agar role-nya `TEACHER`
- pastikan tabel `profiles` user tersebut terhubung ke role `TEACHER`

## Fitur Aplikasi

### Fitur Umum

- Login berbasis Supabase Auth
- Session login berbasis PHP session
- Redirect otomatis berdasarkan role
- Logout
- Upload foto profil `JPG/PNG` maksimal 5 MB
- Formatting waktu berbasis timezone aplikasi

### Fitur Auth

- Register student
- Login
- Reset password via halaman `auth-forgot.php`
- Reset password via token di halaman `auth-reset.php`
- Halaman konfirmasi email

### Fitur User / Student

- Melihat dashboard student
- Update foto profil
- Melihat assessment yang:
  - sedang dibuka
  - belum dibuka
  - sudah ditutup
  - sudah selesai dikerjakan
- Melihat detail assessment sebelum mulai
- Join assessment dengan password opsional
- Lanjutkan attempt yang sudah pernah dimulai
- Mengerjakan soal pilihan ganda
- Submit jawaban
- Melihat hasil attempt:
  - score
  - jumlah benar
  - jumlah salah
  - jumlah kosong
- Melihat feedback/evaluasi dari guru

### Fitur Admin / Teacher

- Melihat dashboard assessment milik sendiri
- Update foto profil
- Membuat assessment baru
- Mengatur:
  - judul
  - deskripsi
  - mapel
  - start time
  - end time
  - durasi
  - publish/draft
  - password assessment opsional
- Menambah soal pilihan ganda
- Mengubah urutan soal
- Mengubah jawaban benar
- Menghapus soal
- Melihat rekap hasil siswa
- Membuka detail jawaban tiap siswa
- Menulis evaluasi/feedback ke siswa
- Menghapus attempt siswa agar bisa mengerjakan ulang
- Menghapus assessment

## Alur Role User

### 1. Registrasi

1. User membuka `auth-register.php`
2. User mengisi nama, email, password, dan opsional foto profil
3. Sistem membuat akun Supabase Auth
4. Sistem membuat profile dengan role `STUDENT`
5. User diarahkan ke halaman login

### 2. Login

1. User login dari `auth-login.php`
2. Sistem cek role user
3. Jika role bukan `TEACHER`, user diarahkan ke `member/student.php`

### 3. Melihat Dashboard

Di dashboard student, assessment dibagi menjadi 4 grup:

- `Dibuka`
- `Belum Dibuka`
- `Tutup`
- `Selesai Dikerjakan`

User juga bisa update foto profil dari modal di header.

### 4. Memulai Assessment

1. User membuka detail assessment
2. Sistem cek apakah assessment:
   - belum mulai
   - sudah tutup
   - sudah pernah disubmit
   - butuh password atau tidak
3. Jika valid, sistem membuat `attempt` dengan status `IN_PROGRESS`
4. Jika user sudah punya attempt aktif, sistem mengarahkan ke attempt lama

### 5. Mengerjakan Soal

1. User membuka halaman `student-attempt.php`
2. Sistem memuat semua soal dan opsi jawaban
3. User memilih jawaban
4. Saat submit:
   - response lama dihapus
   - response baru disimpan
   - skor dihitung otomatis
   - attempt ditandai `SUBMITTED`

### 6. Melihat Hasil

1. User diarahkan ke `student-attempt-result.php`
2. Sistem menampilkan score, benar, salah, kosong, total
3. Jika guru memberi evaluasi, feedback tampil di dashboard student pada assessment yang sudah selesai

## Alur Role Admin

### 1. Login Admin

1. Admin login dari `auth-login.php`
2. Jika role user adalah `TEACHER`, sistem mengarahkan ke `admin/teacher.php`

### 2. Membuat Assessment

1. Admin membuka `teacher-assessment-new.php`
2. Admin mengisi detail assessment
3. Sistem mencari atau membuat `subject`
4. Assessment disimpan ke tabel `assessments`
5. Setelah tersimpan, admin diarahkan ke halaman edit assessment

### 3. Mengelola Soal

Di halaman edit assessment, admin bisa:

1. mengubah detail assessment
2. menambah soal baru
3. menentukan poin
4. menentukan nomor urut soal
5. membuat sampai 4 opsi jawaban
6. memilih jawaban yang benar
7. mengedit soal yang sudah ada
8. menghapus soal

### 4. Publish Assessment

Admin dapat mencentang `Publish` agar assessment tampil di dashboard student. Status assessment di dashboard admin akan berubah sesuai kondisi:

- `DRAFT`
- `BELUM`
- `OPEN`
- `CLOSED`

### 5. Melihat Hasil Siswa

1. Admin membuka `teacher-assessment-results.php`
2. Sistem menampilkan daftar attempt siswa
3. Rekap menampilkan:
   - nama siswa
   - score
   - benar
   - salah
   - kosong
   - waktu submit

### 6. Review Detail Attempt

1. Admin membuka detail attempt siswa
2. Sistem menampilkan semua soal
3. Setiap opsi ditandai:
   - jawaban benar
   - jawaban yang dipilih tapi salah
   - kunci jawaban
   - tidak dijawab
4. Admin bisa menyimpan evaluasi untuk siswa

### 7. Reset Attempt Siswa

Admin bisa menghapus data attempt siswa dari halaman hasil. Saat reset dilakukan:

- feedback guru dihapus
- response jawaban dihapus
- attempt dihapus

Setelah itu siswa dapat mengerjakan assessment yang sama lagi dari awal.

## Catatan Implementasi

- Role `admin` di bisnis aplikasi sebenarnya diimplementasikan sebagai `TEACHER`.
- Register publik hanya membuat akun `STUDENT`.
- Password assessment disimpan dalam bentuk hash.
- Foto profil diupload ke bucket `profiles`.
- Scoring dihitung otomatis dari kecocokan `responses` dengan `answer_keys`.
- Durasi assessment sudah disimpan dan ditampilkan, tetapi di implementasi saat ini belum ada countdown/timer paksa di halaman pengerjaan.
- Halaman `auth-forgot.php` melakukan reset password langsung dengan service role setelah email dan password baru diisi, jadi alurnya bukan email reset link murni.
- `auth-confirm.php` hanya halaman informasi; pada proses register sekarang user dibuat dengan `email_confirm = true`.

## Kesimpulan Analisa

Secara struktur, proyek ini sudah terpisah cukup rapi untuk aplikasi PHP sederhana:

- `src/bootstrap.php` berfungsi sebagai pusat logic inti
- `public/admin` menampung seluruh flow admin
- `public/member` menampung seluruh flow user
- `assets/style.css` menangani seluruh styling

Fokus utama aplikasi ini adalah assessment pilihan ganda dengan penilaian otomatis, feedback guru, dan pemisahan akses yang jelas antara student dan teacher.
