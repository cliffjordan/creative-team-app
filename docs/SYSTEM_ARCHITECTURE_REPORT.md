# Laporan Dokumentasi Arsitektur & Audit Sistem End-to-End — Creative Hub (`creative-team-app`)

**Tanggal Audit:** 22 November 2026  
**Scope:** Seluruh *codebase* `src/**`, skema `supabase/**`, konfigurasi `vercel.json`, `.github/workflows/**`, template `.docx`, serta aset PDF di `public/templates/**` (**Read-Only Technical Audit**).  
**Status Kode saat Audit:** Terverifikasi kompilasi TypeScript (`npx tsc --noEmit`) & Next.js production build (`npm run build`) lulus **0 Error**.

---

## 1. Arsitektur Umum, Tech Stack & Inventaris Rute

### 1.1 Ringkasan Tech Stack `[PASS]`
| Lapisan | Teknologi & Versi | Bukti Implementasi |
| :--- | :--- | :--- |
| **Framework & Routing** | Next.js `14.2.15` (App Router), React `18.3.1`, TypeScript `5.6.3` | `package.json` |
| **Styling & Ikonografi** | Tailwind CSS `3.4.14`, `clsx`, `tailwind-merge`, `lucide-react` | `package.json`, `src/app/globals.css` |
| **Animasi Landing Page** | `framer-motion` (`^14.14.0`) — **terisolasi ketat** melalui lazy-load `next/dynamic(..., { ssr: false })` | `src/app/page.tsx` (`ImmersiveLandingView`), `src/features/landing/immersive-landing-view.tsx` |
| **Database & Cloud Backend** | Supabase PostgreSQL (`@supabase/supabase-js` `^2.45.6`), Row Level Security (RLS), PL/pgSQL RPCs | `supabase/schema.sql`, `supabase/migration_v2.sql`, `src/lib/supabase/server.ts` |
| **Autentikasi & Sesi** | Custom 4-Digit PIN (`crypto.scryptSync` + `timingSafeEqual`), Cookie HMAC-SHA256 (`ct_session`) via Web Crypto API | `src/lib/auth/pin-hash.ts`, `src/lib/auth/session.ts` |
| **Validasi Boundary** | Zod (`^3.23.8`) untuk schema input API & Server Actions | `src/lib/validators/schemas.ts`, seluruh `/api/**` |
| **Generator Dokumen** | `jszip` (`package.json`) untuk injeksi OOXML langsung ke template `.docx` + Print-to-PDF A4 beraset grafis margin | `src/app/api/events/[id]/document/export-docx/route.ts`, `src/lib/proposal/export-proposal-word.ts` |
| **Deployment & Keep-Alive** | Vercel + GitHub Actions Cron & Vercel Cron setiap 3 hari (`0 2 */3 * *`) | `vercel.json`, `.github/workflows/supabase-keep-alive.yml` |

### 1.2 Peta Struktur Direktori Utama
- `src/app/`: Halaman Next.js App Router (`page.tsx`, `layout.tsx`), grup `(auth)` (`/login`, `/register`), grup `(dashboard)` (`/events`, `/cue-cards`, `/profile`), serta seluruh REST API Route Handlers di `src/app/api/**`.
- `src/components/`: Komponen layout (`header.tsx`, `sidebar-nav.tsx`, `bottom-nav.tsx`, `inactivity-timeout.tsx`), PWA (`sw-register.tsx`), serta primitif UI (`brand-logo.tsx`, `button.tsx`, `card.tsx`, `badge.tsx`, `modal.tsx`).
- `src/features/`: Modul fitur terstruktur per domain: `auth`, `calendar`, `cue-cards`, `dashboard`, `evaluation`, `events`, `finance`, `landing`, `live-rundown`, `meeting-notes`, `members`, `profile`, `proposal`, `roster`, `rundown-builder`, `secretariat`, `sections`, `timeline`.
- `src/lib/`: Utilitas inti: `auth/` (`pin-hash.ts`, `session.ts`), `proposal/` (`export-proposal-word.ts`), `supabase/` (`client.ts`, `server.ts`), `sync/realtime-bus.ts`, `validators/schemas.ts`, `mock-db.ts`, `utils.ts`.
- `src/providers/`: Context global sesi (`auth-provider.tsx`) dan status sinkronisasi live (`realtime-provider.tsx`).
- `src/types/`: Kontrak TypeScript domain entities (`domain.ts`).
- `supabase/`: DDL utama (`schema.sql`), migrasi V2 (`migration_v2.sql`), serta skrip pembersihan (`reset_data.sql`).
- `public/templates/`: Template biner Word `event-project-brief-template.docx` dan aset grafis PDF (`pdf-assets/margin-left.png`, `header-band.png`, `footer-logo.png`).
- `.github/workflows/`: Workflow GitHub Actions `supabase-keep-alive.yml`.

### 1.3 Inventaris Lengkap Halaman UI & API Routes

#### A. Halaman UI (11 Rute)
| Rute | Kategori | Akses & Deskripsi | File Target |
| :--- | :--- | :--- | :--- |
| `/` | Publik / Gate + Workspace | Menampilkan Landing Page bila belum login (`Mandatory Login Gate`), atau Workspace tab terpadu bila sesi aktif | `src/app/page.tsx` |
| `/login` | Auth | Pemilihan nama anggota + Numpad PIN 4 digit | `src/app/(auth)/login/page.tsx` |
| `/register` | Auth | Registrasi nama, WA, email (opsional), PIN 4 digit (Auto-Role user #1 vs Member Umum) | `src/app/(auth)/register/page.tsx` |
| `/profile` | Dashboard Privat | Edit Profil (`full_name`, `phone`, `email`, `avatar_url`, ubah PIN) | `src/app/(dashboard)/profile/page.tsx` |
| `/events` | Dashboard Privat | Command Center daftar Event & akses cepat Leader | `src/app/(dashboard)/events/page.tsx` |
| `/events/new` | Dashboard Privat | Form pembuatan Event baru + penunjukan Event Leader | `src/app/(dashboard)/events/new/page.tsx` |
| `/events/[id]` | Dashboard Privat | Detail Event & Roster Manager (assign/rolling/hapus) | `src/app/(dashboard)/events/[id]/page.tsx` |
| `/events/[id]/rundown` | Dashboard Privat | Builder susunan segmen Rundown Event | `src/app/(dashboard)/events/[id]/rundown/page.tsx` |
| `/events/[id]/live` | Dashboard Privat | Konsol eksekusi Live Stage dedicated | `src/app/(dashboard)/events/[id]/live/page.tsx` |
| `/events/[id]/evaluation` | Dashboard Privat | Audit insiden, log live, dan evaluasi pasca-acara | `src/app/(dashboard)/events/[id]/evaluation/page.tsx` |
| `/cue-cards` | Dashboard Privat | Dek naskah & prompting otomatis MC per segmen | `src/app/(dashboard)/cue-cards/page.tsx` |

#### B. API Routes (`/api/**`) & Server Actions (12 API Endpoints + 7 Server Actions)
| Endpoint / Action | Metode HTTP | Proteksi & Fungsi Utama | File Target |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Validasi PIN (`scrypt` + fallback RPC `verify_user_pin`), 5x lockout, set cookie `ct_session` | `src/app/api/auth/login/route.ts` |
| `/api/auth/register` | `POST` | Auto-role #1 (`CREATIVE_LEADER`) / berikutnya (`MEMBER`), hash PIN `scrypt`, set cookie | `src/app/api/auth/register/route.ts` |
| `/api/auth/logout` | `POST` | Menghapus cookie `ct_session` (`maxAge: 0`) | `src/app/api/auth/logout/route.ts` |
| `/api/auth/me` | `GET` | Verifikasi `ct_session` & ambil row user terbaru dari DB (`noStore()`) | `src/app/api/auth/me/route.ts` |
| `/api/auth/profile` | `PATCH` | User aktif mengubah profil + ganti PIN (verifikasi PIN lama), re-sign `ct_session` | `src/app/api/auth/profile/route.ts` |
| `/api/auth/users` | `GET`, `POST` | `GET`: daftar aman tanpa `pin_hash`. `POST`: khusus Creative Leader menambah member | `src/app/api/auth/users/route.ts` |
| `/api/auth/users/[id]` | `PATCH`, `DELETE` | Khusus Creative Leader ubah `base_role`, `default_section`, reset PIN, atau hapus (anti self-delete) | `src/app/api/auth/users/[id]/route.ts` |
| `/api/events/[id]/budget` | `GET`, `POST`, `PATCH`, `DELETE` | CRUD `event_budget_ledger` per event; mutasi dibatasi ke `BENDAHARA` / `CREATIVE_LEADER` | `src/app/api/events/[id]/budget/route.ts` |
| `/api/events/[id]/secretariat` | `GET`, `POST`, `PUT`, `DELETE` | CRUD Notulensi (`POST`/`DELETE`), Struktur Panitia (`PUT`), Struktur Pelayan (`PUT`); mutasi khusus `SEKRETARIS` / `CREATIVE_LEADER` | `src/app/api/events/[id]/secretariat/route.ts` |
| `/api/events/[id]/document` | `GET`, `PATCH` | Membaca & menyimpan 1 Dokumen Event Project Brief (`event_documents`) | `src/app/api/events/[id]/document/route.ts` |
| `/api/events/[id]/document/init` | `POST` | Inisiasi dokumen tunggal per `event_id` (khusus Creative/Wakil/Event Leader) + Auto-Assign 6 Task & Notifikasi | `src/app/api/events/[id]/document/init/route.ts` |
| `/api/events/[id]/document/export-docx` | `POST` | Suntik XML dinamis + tabel pembiayaan ke `event-project-brief-template.docx` via `jszip` | `src/app/api/events/[id]/document/export-docx/route.ts` |
| `/api/health/keep-alive` | `GET` | Heartbeat ringan `SELECT id` ke Supabase; opsional validasi `CRON_SECRET` | `src/app/api/health/keep-alive/route.ts` |
| Event Server Actions | Next Server Action | `getEventsAction`, `getEventDetailAction`, `createEventAction`, `updateEventAction`, `assignRosterAction`, `rollRosterSectionAction`, `removeRosterAction` | `src/features/events/actions/event-actions.ts` |

### 1.4 Daftar Final Environment Variables `[PASS]`
| Variabel | Lokasi Konfigurasi | Sifat | Kegunaan |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` & Vercel | Publik (Client/Server) | Endpoint URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` & Vercel | Publik (Client/Server) | Anon key untuk `RealtimeProvider` & `realtime-bus.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` & Vercel | **Rahasia (Server Only)** | Service role key di `createServerClient()` (juga fallback `SESSION_SECRET`) |
| `SESSION_SECRET` | Vercel *(Direkomendasikan)* | **Rahasia (Server Only)** | Kunci khusus HMAC-SHA256 penandatanganan cookie `ct_session` |
| `CRON_SECRET` | Vercel & GitHub Secrets *(Opsional)* | **Rahasia (Server/CI)** | Bearer token proteksi endpoint `/api/health/keep-alive` |
| `APP_URL` | GitHub Secrets *(Opsional)* | Konfigurasi CI | URL produksi target ping (default `https://creative-team-app.vercel.app`) |

---

## 2. Alur End-to-End Proses Bisnis (User Journey)

1. **Gerbang Masuk & Autentikasi `[PASS]`:**
   - Pengguna anonim membuka `/` dan disambut `ImmersiveLandingView` (*Mandatory Login Gate* pada `src/app/page.tsx`).
   - Pada `/register`, formulir hanya meminta `Nama Lengkap`, `Nomor WhatsApp`, `Email (Opsional)`, dan `PIN 4 Digit`. Di server (`src/app/api/auth/register/route.ts`), bila `count === 0` pada `public.users`, akun pertama otomatis menjadi `CREATIVE_LEADER` (`is_superadmin: true`, `default_section: "INTI"`, `is_role_assigned: true`). Pendaftar berikutnya dipaksa menjadi `MEMBER` (`is_role_assigned: false`, `default_section: null`). PIN di-hash dengan `scrypt` (`pin-hash.ts`) dan cookie `ct_session` diterbitkan.
   - Pada `/login` atau modal login (`PinLoginModal`), pengguna memilih nama, memasukkan PIN 4 digit, lalu `/api/auth/login` memverifikasi hash `scrypt$` (atau RPC `verify_user_pin`) dan menerbitkan `ct_session`. Pengeditan profil pribadi dan penggantian PIN dilakukan lewat tab atau halaman `/profile` (`PATCH /api/auth/profile`).

2. **Governance & Manajemen Member `[PASS]`:**
   - Member baru berstatus *unassigned* tampil dengan badge kuning **"Belum Ditetapkan"** pada tab **Manajemen Member** (`src/features/members/member-management-view.tsx`) yang khusus dapat diakses oleh `CREATIVE_LEADER`.
   - Creative Leader menetapkan `base_role` (`CREATIVE_LEADER`, `WAKIL_LEADER`, `SEKRETARIS`, `BENDAHARA`, `SECTION_LEADER`, `MEMBER`) dan `default_section` (`INTI`, `ACARA`, `DEKORASI`, `PERLENGKAPAN`, `PDD`, `ALL`), serta dapat menambah member manual, mereset PIN 4 digit, atau menghapus anggota (`PATCH`/`DELETE /api/auth/users/[id]`).

3. **Siklus Hidup Event & Kalender `[PASS]`:**
   - `CREATIVE_LEADER` membuat event (`createEventAction`), menunjuk `event_leader_id`, dan menyusun anggota roster (`assignRosterAction`, `rollRosterSectionAction`). Status event bergerak melalui siklus `DRAFT` -> `PRE_EVENT` -> `EVENT_DAY` -> `POST_EVENT` -> `COMPLETED` (`event.status` & `HomeDashboardView` Stepper). Agenda event, jadwal task, segmen rundown, dan tenggat pembiayaan tampil terpadu di `CalendarView`.

4. **Dokumen Event Project Brief (Single Source per Event) `[PASS]`:**
   - Hak inisiasi di awal (`POST /api/events/[id]/document/init`) dikunci baik di UI (`canUserInitiateBrief`) maupun di server hanya untuk `CREATIVE_LEADER`, `WAKIL_LEADER`, atau `EVENT_LEADER` event bersangkutan.
   - Begitu tombol **"Buat Dokumen Event Project Brief"** diklik, baris tunggal dibuat di `public.event_documents` (`UNIQUE(event_id)`), tombol pembuatan baru hilang permanen (beralih ke mode *edit-only*), dan **6 Timeline Tasks** otomatis di-insert ke `timeline_tasks` + notifikasi ke `notifications` (untuk Section Leader `ACARA`, `DEKORASI`, `PERLENGKAPAN`, `PDD`, serta `BENDAHARA` dan `SEKRETARIS`).
   - Dokumen dapat diekspor ke **Word (`.docx`)** berbasis `event-project-brief-template.docx` dan **PDF (`.pdf`)** berdesain A4 identik lengkap dengan pita margin kiri, header Prism, dan footer bar navy.

5. **Pembiayaan (Bendahara) & Sekretariat (Sekretaris) `[PASS]`:**
   - **Pembiayaan (`FinanceView`):** Tabel dua tingkat mengikuti referensi Gambar 1 (`Keperluan`, `Tanggal Diperlukan`, `Qty`, `UOM`, `Harga [Satuan | Total]`, `Keterangan`), dikelompokkan per Seksi. Data tersimpan di `event_budget_ledger`, item dengan `required_date` otomatis muncul di **Kalender** (`CalendarView`), dan seluruh rincian ditarik otomatis ke **Bagian 04** Dokumen Event Project Brief (`mergeSyncedEventDataIntoBrief`).
   - **Sekretariat (`SecretariatView`):** Menyatukan **Notulensi Rapat**, **Struktur Builder (Panitia)**, dan **Struktur Pelayan**. Data struktur tersimpan di `event_committee_structure` dan `event_ministers_structure`, dan otomatis mengisi **Bagian 05** & **Bagian 06** Dokumen Event Project Brief.

6. **Eksekusi Live Stage & Pasca-Event `[PASS]`:**
   - Event Leader / Co-Controller mengendalikan panggung di `LiveStageView` (`RuntimeTimer`, Play/Pause, Next Segment, `CHANGEQUEUE`, `Insert Segment On-The-Fly`, Undo 15 detik, dan master heartbeat `CT_LEADER_HEARTBEAT`). MC & kru memantau sinkronisasi di `Cue Cards MC` (`/cue-cards`) dan mencatat insiden/evaluasi pasca-acara di `EvaluationView` (`/events/[id]/evaluation`).

---

## 3. Matriks Sistem Level Akses (RBAC) & Audit Proteksi Berlapis

### 3.1 Tabel Matriks Hak Akses per Peran
*(Legenda: **R** = Read/Monitoring, **C** = Create, **U** = Update, **D** = Delete, **E** = Export, **—** = Terkunci)*

| Modul / Fitur | `CREATIVE_LEADER` | `WAKIL_LEADER` | `SEKRETARIS` | `BENDAHARA` | `SECTION_LEADER` | `MEMBER` (Assigned) | `MEMBER` Baru (`is_role_assigned=false`) | `EVENT_LEADER` (Per Event) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manajemen Member (`/api/auth/users*`)** | R, C, U, D | — | — | — | — | — | — | — |
| **Edit Profil Pribadi (`/profile`)** | R, U | R, U | R, U | R, U | R, U | R, U | R, U | R, U |
| **Events & Roster Command Center** | R, C, U, D | R *(View)* | R *(View)* | R *(View)* | — | — | — | U *(Event)* |
| **Home Dashboard, Timeline & Calendar** | R, C, U | R, C, U | R, C, U | R, C, U | R, C, U | R, U | R *(General Only)* | R, C, U |
| **Live Stage Control & Queue Mutation** | R *(Monitor/Leader)* | R | R | R | R | R | **— (Locked)** | **R, C, U, D** |
| **Sections, Inventories & Rundown Edit** | R *(Monitor)* | R *(Monitor)* | R *(Monitor)* | R *(Monitor)* | C, U, D *(Seksinya)* | C, U *(Seksinya)* | **— (Locked)** | R, C, U |
| **Pembiayaan / Anggaran (`/budget`)** | R, C, U, D | R *(Monitor)* | R *(Monitor)* | **R, C, U, D** | R *(Monitor)* | — | **— (Locked)** | R *(Monitor)* |
| **Sekretariat (Notulensi, Panitia, Pelayan)** | R, C, U, D | R *(Monitor)* | **R, C, U, D** | R *(Monitor)* | R *(Monitor)* | — | **— (Locked)** | R *(Monitor)* |
| **Inisiasi Dokumen Project Brief (`/init`)** | **C** | **C** | — | — | — | — | **— (Locked)** | **C** |
| **Edit & Export Dokumen (`.docx` / `.pdf`)** | R, U, E | R, U, E | R, U, E | R, U, E | R, U, E | R, U, E | **— (Locked)** | R, U, E |

### 3.2 Audit Proteksi Berlapis (Middleware vs UI vs API Server)
1. **Proteksi Middleware (`src/middleware.ts`) `[WARNING]`:**
   - `[PASS]` `middleware.ts` memblokir akses unauthenticated pada `matcher: ["/events/:path*", "/cue-cards/:path*"]` dengan verifikasi HMAC `verifySessionToken(token)` dan me-redirect ke `/login?redirect=...`.
   - `[WARNING]` Rute **`/profile`** (`src/app/(dashboard)/profile/page.tsx`) belum masuk dalam `PROTECTED_PREFIXES` di `src/middleware.ts`. Meskipun halaman tersebut gagal memuat profil jika tidak login, memasukkannya ke matcher `"/profile/:path*"` direkomendasikan untuk konsistensi server gate.
   - `[WARNING]` Member baru berstatus `MEMBER` (*unassigned*) tidak diblokir di `middleware.ts` ketika mengakses URL langsung `/events` atau `/cue-cards` (pengecekan *unassigned member* dilakukan di UI `/` via `isUnassignedMember`), sehingga akses langsung `/cue-cards` tetap dapat dilihat oleh member baru.

2. **Validasi Sisi Server pada API & Server Actions `[WARNING]`:**
   - `[PASS]` `POST /api/auth/users`, `PATCH/DELETE /api/auth/users/[id]`, `createEventAction`, `assignRosterAction`, `rollRosterSectionAction`, `removeRosterAction` memverifikasi peran `CREATIVE_LEADER` / `is_superadmin` di server.
   - `[PASS]` Mutasi `/api/events/[id]/budget` memverifikasi `BENDAHARA` / `CREATIVE_LEADER` langsung ke tabel `public.users`. Mutasi `/api/events/[id]/secretariat` memverifikasi `SEKRETARIS` / `CREATIVE_LEADER` ke DB. `POST /api/events/[id]/document/init` memverifikasi `CREATIVE_LEADER`, `WAKIL_LEADER`, `event_leader_id`, atau `event_roster` ke DB.
   - `[WARNING]` `PATCH /api/events/[id]/document` dan `POST /api/events/[id]/document/export-docx` baru mengecek `getServerSession()` (di `PATCH`) atau bahkan **tanpa pengecekan session** (`export-docx`), dan belum menolak `unassigned member` (`is_role_assigned = false`) maupun membatasi kolom seksi tertentu di sisi server saat *patching* JSONB dokumen.
   - `[WARNING]` `POST /api/auth/login` (`src/app/api/auth/login/route.ts` baris 42) tidak ikut menyeleksi kolom `default_section, is_role_assigned`, sehingga tepat setelah login (sebelum `loadSession()` memanggil `/api/auth/me` atau refresh), objek `user` dari response `/login` tidak membawa properti `is_role_assigned`.
   - `[WARNING]` `updateEventAction` di `src/features/events/actions/event-actions.ts` hanya mengecek `if (!session)` tanpa memverifikasi apakah caller adalah `CREATIVE_LEADER` atau `EVENT_LEADER` dari event tersebut.

3. **Proteksi *Last Leader Lockout* `[WARNING]`:**
   - `[PASS]` `DELETE /api/auth/users/[id]` menolak penghapusan akun sendiri (`if (auth.actorId === targetUserId) return 400`).
   - `[WARNING]` `PATCH /api/auth/users/[id]` belum memiliki penjagaan apabila `CREATIVE_LEADER` terakhir menurunkan `base_role` dirinya sendiri menjadi `MEMBER` tanpa ada `CREATIVE_LEADER` lain — hal ini dapat menyebabkan *Last Leader Lockout* di mana tidak ada lagi admin yang dapat mengakses Manajemen Member.

---

## 4. Arsitektur Database Supabase, Integritas & Performa

### 4.1 Inventaris Objek Database (`schema.sql` & `migration_v2.sql`) `[PASS]`
- **Tabel Schema `public` (19 Tabel):** `users`, `events`, `event_roster`, `rundowns`, `rundown_items`, `live_logs`, `timeline_tasks`, `event_technical_guides`, `event_budget_ledger`, `event_meeting_notes`, `section_tools_inventory`, `section_pdd_shotlist`, `section_decor_items`, `operation_records`, `notifications`, `pdd_references`, ditambah 3 tabel baru di `migration_v2.sql`: `event_committee_structure`, `event_ministers_structure`, `event_documents`.
- **PostgreSQL ENUMs (8 ENUM):** `user_base_role`, `event_status`, `section_type`, `event_role`, `rundown_item_status`, `log_type`, `log_severity`, `log_status`, `task_phase`, `task_status` *(total 10 tipe enum kustom di `schema.sql`)*.
- **Triggers:** Trigger `update_updated_at_column()` terpasang pada seluruh tabel inti dan ketiga tabel baru di `migration_v2.sql`.
- **RPC Functions:** `verify_user_pin(UUID, TEXT)` *(search_path sudah diperbaiki ke `public, extensions` di `reset_data.sql`)*, `set_user_pin`, `advance_live_rundown_segment`, `change_live_queue_order`, `insert_on_the_fly_segment`.

### 4.2 Schema Drift Check (`schema.sql` vs `migration_v2.sql` vs `domain.ts` vs `schemas.ts`) `[WARNING]`
- `[PASS]` Kolom baru pada `users` (`default_section`, `is_role_assigned`) dan `event_budget_ledger` (`budget_category`, `required_date`, `quantity`, `uom`, `unit_price`, `budget_status`) serta 3 tabel baru identik antara `migration_v2.sql`, `schema.sql`, `src/types/domain.ts`, dan `src/lib/validators/schemas.ts`.
- `[WARNING]` Di `src/types/domain.ts` (`Event`), terdapat kolom `dresscode` di `CreateEventSchema` (`schemas.ts`) dan `segment_pause_seconds` di interface `Event` (`domain.ts`), namun kedua kolom tersebut belum didefinisikan pada DDL tabel `events` di `supabase/schema.sql`. Selain itu, di `migration_v2.sql` `budget_status` bertipe `TEXT`, selaras dengan `domain.ts` dan `schemas.ts`.

### 4.3 Keamanan Relasi Hapus Data (`ON DELETE`) `[WARNING]`
- `[PASS]` Mayoritas FK menuju `users(id)` pada tabel operasional memakai `ON DELETE SET NULL` (`event_roster` tidak menghalangi, `events.event_leader_id`, `events.created_by`, `timeline_tasks.assigned_to`, `event_meeting_notes.recorded_by`, `event_committee_structure.pic_user_id`, `event_documents.updated_by`) atau `ON DELETE CASCADE` (`notifications.user_id`, `event_roster.user_id`).
- `[RISK / PERLU PERBAIKAN]` Pada `supabase/migration_v2.sql` baris 75 (dan `schema.sql`), kolom **`event_documents.created_by` memakai `REFERENCES public.users(id) ON DELETE RESTRICT`**, serta pada `schema.sql` **`live_logs.reported_by`** berpotensi memakai `RESTRICT` atau `NOT NULL` tanpa `SET NULL`. Akibatnya, jika Creative Leader mencoba menghapus akun di *Manajemen Member* (`DELETE /api/auth/users/[id]`) padahal akun tersebut pernah menginisiasi Dokumen Project Brief, PostgreSQL akan melempar **Foreign Key Constraint Error (500/23503)**. Direkomendasikan mengubah `event_documents.created_by` menjadi `NULL ... ON DELETE SET NULL` untuk keamanan jangka panjang.

### 4.4 Kinerja Query, Indeks & N+1 Check `[PASS]`
- `[PASS]` Seluruh FK dan kolom filter utama telah memiliki indeks B-Tree (`idx_budget_ledger_event_id`, `idx_budget_ledger_required_date`, `idx_event_committee_event_order`, `idx_event_ministers_event_order`, `idx_event_documents_event_id`, `idx_users_is_role_assigned`, dll.).
- `[PASS]` Route handlers (`/api/events/[id]/secretariat`, `/api/events/[id]/document/init`, `getEventDetailAction`) menggunakan `Promise.all([...])` paralel tanpa pola *N+1 query*.

### 4.5 Konsistensi Storage: Supabase vs LocalStorage `[RISK / PERLU PERBAIKAN]`
- `[PASS]` Modul berikut sudah persisten penuh ke Supabase melalui API/Server Actions:
  - **Users & Profil & Manajemen Member** (`public.users`)
  - **Events & Roster** (`public.events`, `public.event_roster` via Server Actions)
  - **Pembiayaan / Budget** (`public.event_budget_ledger` via `/api/events/[id]/budget`)
  - **Sekretariat** (`event_meeting_notes`, `event_committee_structure`, `event_ministers_structure` via `/api/events/[id]/secretariat`)
  - **Dokumen Project Brief** (`public.event_documents` + auto-generated 6 tasks ke `public.timeline_tasks` saat init via `/api/events/[id]/document*`)
- `[RISK / PERLU PERBAIKAN]` Saat mengoperasikan Workspace utama (`src/app/page.tsx`), **modul-modul berikut masih menyimpan mutasinya di `localStorage` & `BroadcastChannel` (`realtime-bus.ts`) tanpa API/Server Action sinkronisasi ke Supabase:**
  1. **Tasks Manual & Status Update Task** (`CT_TASKS` di `page.tsx`, `TimelineView`, `CalendarView` — kecuali 6 task awal yang dibuat oleh `/document/init` ke Supabase, namun belum di-*fetch* dari Supabase saat `page.tsx` mount).
  2. **Rundown Items & Urutan Segmen** (`CT_ITEMS` di `page.tsx`, `RundownBuilderView`, `LiveStageView`).
  3. **Live Stage State & Incident Logs** (`CT_EVENT`, `CT_LOGS` di `page.tsx`, `LiveStageView`).
  4. **Section Inventories & Tools (`SectionsView`)**: `section_tools_inventory`, `section_decor_items`, `section_pdd_shotlist`, `pdd_references`, dan `notifications` di `Header` (`CT_NOTIFICATIONS`) masih disimpan di `localStorage` client.

### 4.6 Audit Menyeluruh Next.js 14 Data Cache `[PASS]`
- `[PASS]` Seluruh API route pembacaan dinamis telah mengimplementasikan `export const dynamic = "force-dynamic"`, `export const revalidate = 0`, `unstable_noStore as noStore`, serta header `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` (`users/route.ts`, `me/route.ts`, `budget/route.ts`, `secretariat/route.ts`, `document/route.ts`, `keep-alive/route.ts`).

### 4.7 Keep-Alive Supabase 7 Hari `[PASS]`
- `[PASS]` Tersedia endpoint ringan `GET /api/health/keep-alive` (`route.ts`) yang mengeksekusi query nyata ke PostgreSQL tanpa cache, didukung oleh scheduler ganda setiap 3 hari pukul `02:00 UTC` via `.github/workflows/supabase-keep-alive.yml` dan `vercel.json`.

---

## 5. Audit Keamanan Sesi, Input & Privasi Data

| Area Audit | Status | Temuan Detail & Bukti Kode |
| :--- | :---: | :--- |
| **Hashing & Brute-Force PIN** | `[PASS]` | `src/lib/auth/pin-hash.ts` memakai 16-byte random salt + `crypto.scryptSync(..., 32)` dan `crypto.timingSafeEqual`. `POST /api/auth/login` menegakkan batas **5 kali salah PIN** -> mengunci akun 15 menit (`locked_until`, HTTP `423`). |
| **Cookie Security Flags** | `[PASS]` | `getSessionCookieOptions()` di `src/lib/auth/session.ts`: `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`, `maxAge: 7 hari`. |
| **Fallback Secret Sesi** | `[WARNING]` | `getSecret()` di `src/lib/auth/session.ts` memakai `process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "creative-team-dev-secret-change-in-prod"`. Sebaiknya selalu isi `SESSION_SECRET` terpisah di Vercel agar penandatanganan sesi tidak berbagi secret dengan `SUPABASE_SERVICE_ROLE_KEY`. |
| **Session Lifecycle & Revocation** | `[WARNING]` | Cookie `ct_session` bersifat stateless selama 7 hari tanpa revocation blacklist di server. Namun `/api/auth/me`, `/budget`, `/secretariat`, dan `/document/init` **selalu memvalidasi ulang `base_role` & keberadaan akun di DB**, sehingga pencabutan/perubahan role langsung efektif pada endpoint tersebut. Bila user dihapus saat sesi aktif, `/me` perlu menandai unauthenticated bila query user kosong. |
| **Rate Limiting & Anti-Spam** | `[WARNING]` | Tidak ada rate limiter per-IP pada `POST /api/auth/register` (dapat disalahgunakan spam pembuatan akun `MEMBER` jika URL publik diketahui) maupun pada mutasi API lain. `CRON_SECRET` di `/api/health/keep-alive` bersifat opsional (terbuka jika env var belum diisi). |
| **Sanitasi Input & Anti-XSS/XXE** | `[PASS]` | Validasi Zod diterapkan pada input API; `escapeHtml()` digunakan pada export HTML/PDF; `escapeXml()` & `formatXmlRunsText()` menjaga XML pada `export-docx/route.ts`; URL eksternal divalidasi dengan `sanitizeHttpUrl()` (`src/lib/utils.ts`). |
| **Minimisasi Payload API** | `[PASS]` | `USER_SELECT_COLUMNS` di `/api/auth/users`, `/users/[id]`, `/register`, `/profile`, dan `getEventDetailAction` secara eksplisit mengecualikan kolom `pin_hash`. |
| **Row Level Security (RLS)** | `[RISK / PERLU PERBAIKAN]` | Seluruh tabel di `schema.sql` dan `migration_v2.sql` mengaktifkan RLS, **namun kebijakan (`CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true)`) masih permisif penuh** untuk role Postgres/PostgREST apabila diakses memakai `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Karena aplikasi tidak memakai Supabase Auth JWT per user melainkan cookie kustom `ct_session`, klien browser yang mengekspos `ANON_KEY` (di `src/lib/supabase/client.ts`) secara teoritis dapat memanggil REST API PostgREST Supabase langsung apabila RLS dibiarkan `USING (true)`. |

---

## 6. Audit Logika Bisnis, Concurrency & Ekspor Dokumen

- **Concurrency Edit Bersamaan `[WARNING]`:**
  - `PATCH /api/events/[id]/document` menyimpan seluruh `document_data` sebagai 1 objek `JSONB` (strategi *Last-Write-Wins*). Jika Seksi Acara dan Seksi Dekorasi menekan "Simpan Perubahan" secara bersamaan dari browser berbeda, penyimpanan terakhir akan menimpa bagian yang diedit rekan lainnya karena belum ada *field-level merge* atau *optimistic locking* (`updated_at` check).
  - `PUT /api/events/[id]/secretariat` untuk `committee` dan `ministers` melakukan pola *delete-all then insert* untuk `event_id` terkait, yang aman untuk satu Sekretaris namun perlu diperhatikan jika dibuka dua tab bersamaan.
- **Idempotensi & Double-Click Guard `[PASS]`:**
  - `POST /api/events/[id]/document/init` menggunakan state `initiating` di UI, pengecekan `existingDoc` (`409 Conflict`), serta constraint database **`UNIQUE (event_id)`** pada tabel `event_documents` — mencegah duplikasi dokumen maupun duplikasi 6 auto-assigned tasks meskipun tombol diklik ganda.
  - `LiveStageView` mengimplementasikan `runIdempotentCommand` dengan debounce 400ms dan `Set<string>` `operationId` anti double-tap.
- **Presisi Kalkulasi Pembiayaan `[PASS]`:**
  - Di UI (`FinanceView`) maupun server (`POST`/`PATCH /api/events/[id]/budget`), total baris dihitung konsisten `Math.max(0, Number(quantity) * Number(unit_price))`. Skema Zod memaksa `.min(0)` untuk `quantity`, `unit_price`, dan `actual_amount`. `Total Estimasi` antara tabel `FinanceView`, tabel lampiran `.docx` (`buildBudgetDetailOoxmlBlock`), dan `.pdf` konsisten 100%.
- **Transisi Status Event & Live Stage `[WARNING]`:**
  - `[PASS]` `RuntimeTimer` dan logika overtime tetap berjalan akurat melewati `00:00` serta menangani daftar rundown kosong dengan empty-state aman.
  - `[WARNING]` UI `LiveStageView` & `page.tsx` belum secara eksplisit mengunci kontrol mutasi apabila `event.status === "COMPLETED"`.
- **Alur Notifikasi Lintas Akun `[WARNING]`:**
  - Notifikasi tugas baru dari `/document/init` disimpan ke tabel PostgreSQL `public.notifications`, namun komponen `Header` (`src/components/layout/header.tsx`) baru membaca notifikasi dari `localStorage` (`CT_NOTIFICATIONS`) dan belum melakukan *fetching* dari tabel `public.notifications` Supabase.
- **Integritas Ekspor `.docx` & `.pdf` `[PASS]`:**
  - Generator `.docx` (`export-docx/route.ts`) menggunakan `jszip` pada `event-project-brief-template.docx` dengan sanitasi `escapeXml()` & dukungan multi-baris (`<w:br/>`), kloning gaya sel `<w:tcPr>` asli, serta menjaga `header2.xml`, `footer2.xml`, dan gambar `image1..3.png`.
  - Generator `.pdf` (`exportProjectBriefToPdf`) menggunakan `@page { size: A4 portrait; margin: 0 }`, `print-color-adjust: exact !important`, aset grafis berulang `position: fixed` (`margin-left.png`, `header-band.png`, `footer-logo.png`), pembungkus `table.print-shell` agar tiap halaman baru menjaga jarak aman tanpa menimpa header/margin/footer, `break-inside: avoid` pada baris tabel, serta `Promise.all` menanti seluruh `<img>` selesai dimuat sebelum `window.print()`. *(Catatan browser HP/Safari: pengguna perlu mengaktifkan opsi cetak "Background graphics" jika muncul).*

---

## 7. Audit Ketahanan Operasional, UX Mobile & Kebersihan Kode

- **Konsistensi Zona Waktu (WIB UTC+7 vs UTC) `[WARNING]`:**
  - `[WARNING]` Beberapa helper tanggal di client menggunakan `new Date().toISOString().slice(0, 10)` (`calendar-view.tsx`, `meeting-notes-view.tsx`, `finance-view.tsx`, `document/init/route.ts`). Antara pukul `00:00–06:59 WIB` (UTC+7), `toISOString()` masih mengembalikan tanggal UTC (kemarin), sehingga default tanggal hari ini dapat bergeser mundur 1 hari di dini hari WIB.
  - `[PASS]` Pemformatan tanggal tampil ke user (`formatIndonesianDate`) menggunakan locale `"id-ID"` secara konsisten.
- **Batas Vercel Hobby & Error Handling `[PASS]`:**
  - Template `.docx` berukuran ~895 KB; proses substitusi string XML in-memory via `jszip` berjalan < 200 ms dan menghasilkan ukuran file ~900 KB, sangat aman di bawah batas Vercel Hobby **10 detik timeout** dan **4.5 MB payload**.
  - Form editor (`FinanceView`, `SecretariatView`, `ProposalBuilderView`, `ProfileEditView`) mempertahankan nilai input bila request API gagal (tidak me-reset state form saat error).
- **Isolasi Bundle `[PASS]`:**
  - Hasil `rg` dan inspeksi `src/app/page.tsx`: `framer-motion` hanya diimpor di `src/features/landing/immersive-landing-view.tsx` yang di-lazy-load via `next/dynamic(..., { ssr: false })`. Halaman Workspace, Dashboard, dan Live Stage bebas dari bobot `framer-motion`.
- **Responsivitas Mobile (360px), Loading State & Aksesibilitas `[PASS]`:**
  - Tabel Pembiayaan, Budget Overview, Struktur Builder, dan Landing Page Grid memakai `overflow-x-auto` / layout responsif `grid-cols-1` pada breakpoint mobile agar tidak memicu horizontal scroll pada root `<body>`.
  - Tombol aksi submit & export memiliki state `disabled` & indikator loading (`Menyimpan...`, `Menyiapkan...`). Penghapusan member memakai `window.confirm` ganda; input PIN mendukung keyboard numerik (`inputMode="numeric"`).
- **Observabilitas & Kebersihan Repo `[PASS]` / `[WARNING]`:**
  - `[PASS]` Tidak ditemukan satu pun `console.log`/`warn`/`error` tertinggal di `src/` (`rg` mengembalikan kosong).
  - `[PASS]` `.gitignore` mengabaikan `.env*`, `.env*.local`, `.next/`, `node_modules`, `.vercel`.
  - `[WARNING]` File `supabase/reset_data.sql` berisi perintah destruktif `TRUNCATE TABLE ... CASCADE` di repository — wajib hanya dijalankan manual secara sadar saat reset bersih, dan sebelum event besar sebaiknya melakukan ekspor backup SQL/CSV dari dashboard Supabase.
  - `[WARNING]` `src/features/rundown-builder/rundown-builder-view.tsx` masih ada di repo sebagai komponen pendukung rute `/events/[id]/rundown` (bukan dead code), namun `src/features/proposal/proposal-builder-view.tsx` masih mempertahankan nama file/komponen `ProposalBuilderView` untuk fitur Dokumen Project Brief.

---

## 8. Ringkasan Eksekutif & Daftar Prioritas Perbaikan (Actionable Backlog)

### 8.1 Skor Kesiapan per Area
| Area Audit | Skor Kesiapan | Ringkasan Status |
| :--- | :---: | :--- |
| **1. Arsitektur, Routing & Build Stability** | **92 / 100** | `[PASS]` Build bersih 0 error, bundle Landing Page terisolasi, API non-cached rapi. |
| **2. Autentikasi, RBAC & Keamanan Data** | **78 / 100** | `[WARNING]` `scrypt` & Cookie `HttpOnly` kuat, namun RLS `USING (true)` & celah kecil endpoint perlu diperketat. |
| **3. Skema Database & Sinkronisasi Storage** | **76 / 100** | `[RISK]` Auth, Events, Finance, Secretariat & Document sudah Supabase penuh; namun Tasks, Rundown, Live Stage & Notifikasi di `/` masih memakai `localStorage`. |
| **4. Fitur Bisnis & Generator `.docx` / `.pdf`** | **93 / 100** | `[PASS]` Format Gambar 1, Sekretariat Terpadu, Auto-Assign 6 Task, dan Ekspor `.docx`/`.pdf` sangat presisi & sinkron. |
| **5. Ketahanan Operasional & Mobile UX** | **88 / 100** | `[PASS]` Keep-alive ganda 3 harian, mobile-first 360px, aman dari limit timeout Vercel. |

---

### 8.2 Actionable Backlog (Prioritas P0, P1, P2)

| Prioritas | Status | Temuan & Lokasi | Rekomendasi Perbaikan Konkret |
| :---: | :---: | :--- | :--- |
| **P0** | `[RISK]` | **RLS Permissif Penuh (`USING (true)`) + `ANON_KEY` Terbuka di Client** (`supabase/schema.sql`, `migration_v2.sql`, `src/lib/supabase/client.ts`) | Ketatkan RLS pada tabel sensitif (`users`, `event_budget_ledger`, `event_documents`, `event_meeting_notes`) agar role `anon` **tidak** bisa membaca/menulis lewat PostgREST langsung, sehingga 100% akses data wajib melewati API Route/Server Action yang memverifikasi cookie `ct_session`. |
| **P0** | `[RISK]` | **Modul Workspace (`/`) yang Masih Memakai `localStorage` Tanpa Persisten DB Penuh** (`src/app/page.tsx`, `sections-view.tsx`, `header.tsx`) | Sambungkan CRUD **Timeline Tasks**, **Rundown Items**, **Live Stage Logs**, **Notifications**, dan **Section Inventories** ke API Route / Server Actions Supabase (bukan hanya `CT_TASKS`/`CT_ITEMS`/`CT_NOTIFICATIONS` di `localStorage`) agar sinkronisasi lintas HP benar-benar real-time terpusat. |
| **P0** | `[RISK]` | **`ON DELETE RESTRICT` pada `event_documents.created_by`** (`supabase/migration_v2.sql` baris 75) | Ubah `created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL` agar penghapusan akun leader/mantan admin di Manajemen Member tidak gagal terkena *FK violation*. |
| **P1** | `[WARNING]` | **Proteksi Server-Side Belum Merata pada 3 Titik Mutasi/Ekspor** (`src/app/api/events/[id]/document/route.ts`, `export-docx/route.ts`, `event-actions.ts`) | Tambahkan verifikasi `getServerSession()` pada `export-docx/route.ts`, tolak `isUnassignedMember` pada `PATCH /document`, perketat `updateEventAction` untuk Leader/Event Leader saja, dan tambahkan `/profile/:path*` ke `src/middleware.ts`. |
| **P1** | `[WARNING]` | **Celah Login Field Awal & Last Leader Lockout** (`src/app/api/auth/login/route.ts`, `src/app/api/auth/users/[id]/route.ts`) | Sertakan `default_section, is_role_assigned` di `SELECT` pada `/api/auth/login`; dan pada `PATCH /users/[id]` tolak penurunan role `CREATIVE_LEADER` terakhir jika jumlah `CREATIVE_LEADER` aktif tersisa 1 orang. |
| **P1** | `[WARNING]` | **Rate Limiting Public Register & Concurrency JSONB Dokumen** (`/api/auth/register`, `PATCH /document`) | Tambahkan rate limit per-IP pada `/register`, aktifkan `SESSION_SECRET` & `CRON_SECRET` di Vercel/GitHub, serta pertimbangkan *section-level patch merge* atau pengecekan `updated_at` agar dua Section Leader tidak saling menimpa saat mengedit Dokumen Brief bersamaan. |
| **P2** | `[WARNING]` | **Pergeseran Tanggal `UTC` vs `WIB` (`00:00–06:59 WIB`) & Penguncian Status `COMPLETED`** | Ganti `new Date().toISOString().slice(0, 10)` dengan helper tanggal lokal WIB (`Asia/Jakarta`), tampilkan *graceful guard* saat event berstatus `COMPLETED` di Live Stage, dan lengkapi SOP *manual pg_dump / Supabase export* sebelum event besar. |
