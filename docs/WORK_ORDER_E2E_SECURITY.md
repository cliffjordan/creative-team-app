# Work Order Audit E2E, Keamanan, & Peningkatan Aplikasi Creative Team OS

Dokumen ini berisi hasil audit *End-to-End (E2E)*, evaluasi keamanan (*Application Security*), serta rancangan **Work Order (`[WO-01]` s/d `[WO-05]`)** pada *codebase* aktif Creative Team OS.

---

## 1. Hasil Audit E2E & Isolasi Event (`eventId`)

### A. Status Isolasi Data per Event pada Bendahara (Pembiayaan) & Sekretaris (Notulensi)
1. **Menu Pembiayaan (`src/features/finance/finance-view.tsx`) — BELUM TERISOLASI PER EVENT:**
   - Pada `finance-view.tsx` (`filteredBudgets`), filter saat ini hanya memeriksa `sectionFilter === "ALL" || b.section === sectionFilter`, **tanpa memfilter `b.event_id === activeEvent.id`**.
   - **Dampak:** Saat user berpindah ke Event lain di dropdown/selector Header (misalnya dari *Perayaan Natal Kreatif 2026* ke *Ibadah Jumat Agung & Paskah 2027*), daftar item pembelanjaan serta ringkasan KPI **Total Estimasi**, **Total Realisasi (Aktual)**, dan **Selisih Anggaran** milik Event 1 tetap muncul dan tercampur di Event 2.
   - Pada `src/features/proposal/proposal-builder-view.tsx` (`handleSyncFromEvent`), fungsi penarikan anggaran dari `localStorage.getItem("CT_SECTION_BUDGETS")` juga belum memfilter `b.event_id === activeEvent.id`.

2. **Menu Notulensi Rapat (`src/features/meeting-notes/meeting-notes-view.tsx`) — BELUM TERISOLASI PER EVENT:**
   - Komponen `MeetingNotesView` belum menerima prop `activeEvent?: Event` dari `src/app/page.tsx`.
   - Pada `handleAddNote`, notulensi baru selalu tersimpan dengan `event_id: INITIAL_EVENT.id`, dan `filteredNotes` belum memfilter `(n.event_id || INITIAL_EVENT.id) === activeEvent.id`.
   - Penambahan/penghapusan notulensi di `MeetingNotesView` dan `EvaluationView` (`handleAddPostEvalNote`) juga belum memanggil `publishSyncMessage("CT_MEETING_NOTES", ...)` maupun `subscribeSyncMessages`, sehingga belum tersinkron secara *real-time* lintas tab.

### B. Temuan E2E Ketidaksesuaian Tersisa Lainnya
1. **Isolasi Data `SectionsView` & `McCueCardDeck` per Event:**
   - Penambahan item `guides`, `tools`, `shotlists`, dan `pddReferences` di `src/features/sections/sections-view.tsx` sudah menyimpan `event_id: activeEvent.id`, namun tampilan daftar belum menyaring item berdasarkan `(item.event_id || INITIAL_EVENT.id) === activeEvent.id`. Hal serupa terjadi pada `guides` di `src/features/cue-cards/mc-cue-card-deck.tsx`.
2. **Isolasi `LiveLog` (`logs`) & Badge Open Incidents per Event di `src/app/page.tsx`:**
   - `openIncidentsCount` dan prop `logs` yang dikirim ke `HomeDashboardView`, `LiveStageView`, serta `EvaluationView` belum difilter per `(l.event_id || INITIAL_EVENT.id) === event.id`, sehingga insiden Event 1 masih tampil ketika user memilih Event 2.
3. **Sinkronisasi Daftar Event Client–Server di `/events` (`EventListView`):**
   - `src/features/events/event-list-view.tsx` perlu menggabungkan `initialEvents` dari server dengan data pembaruan di `localStorage.getItem("CT_EVENTS")` agar status atau event baru yang dibuat selalu sinkron antara `/events` dan Workspace Utama (`/`).

---

## 2. Hasil Audit Keamanan (Security Findings)

| Severity | Kategori Celah | File & Baris | Risiko | Rekomendasi Mitigasi |
| :--- | :--- | :--- | :--- | :--- |
| **KRITIS** | **Missing Mandatory Auth Gate di Root `/` & `/cue-cards`** | `src/providers/auth-provider.tsx` (baris 67), `src/app/page.tsx` (baris 99), `src/middleware.ts` (baris 4) | Root `/` melakukan auto-login ke `INITIAL_USERS[0]` (`Creative Leader`) saat belum ada sesi, serta `/cue-cards` belum termasuk di `PROTECTED_PREFIXES` pada `middleware.ts`. | Terapkan Mandatory Login Gate (`[WO-05]`): hilangkan auto-login default user, tahan user belum login di Landing Page, dan tambahkan `/cue-cards` ke proteksi sesi. |
| **KRITIS** | **Missing Server-Side RBAC Enforcement pada Server Actions** | `src/features/events/actions/event-actions.ts` (`createEventAction`, `updateEventAction`, `assignRosterAction`, `rollRosterSectionAction`, `removeRosterAction`) | Server Actions mutasi event & roster belum memvalidasi role dari session cookie (`getServerSession()`). Jika dipanggil langsung lewat request/DevTools, user non-Creative Leader bisa memodifikasi event/roster. | Tambahkan guard server `verifyCreativeLeaderAccess()` berbasis `getServerSession()` di seluruh action mutasi event & roster. |
| **TINGGI** | **Unsafe URL Scheme / Potensi XSS (`javascript:` / `data:`)** | `src/features/finance/finance-view.tsx`, `src/features/sections/sections-view.tsx`, `src/lib/proposal/export-proposal-word.ts` | Input `receipt_photo_url`, `driveRefUrl`, `cueImageUrl`, dan `decorImageUrl` belum memfilter skema protokol. Payload `javascript:...` dapat dieksekusi jika tautan dibuka/dirender. | Buat helper `sanitizeHttpUrl(url)` di `src/lib/utils.ts` menggunakan `new URL()` yang hanya mengizinkan `http:` dan `https:`. |
| **SEDANG** | **Privilege Escalation via Manipulasi `localStorage` (`CT_CURRENT_USER`)** | `src/providers/auth-provider.tsx` | Jika user mengubah `base_role` atau `is_superadmin` pada JSON `CT_CURRENT_USER` di `localStorage` via DevTools, UI dapat membaca role hasil manipulasi saat fallback mode. | Rekonsiliasi objek user dari `localStorage` terhadap record resmi `INITIAL_USERS` (`reconcileUserWithCanonical`) agar role selalu mengikuti data kanonis. |
| **AMAN (OK)** | **Kerahasiaan Env & Konfigurasi Cookie Session** | `src/lib/auth/session.ts` (baris 109–118), `src/lib/supabase/server.ts` | `SUPABASE_SERVICE_ROLE_KEY` dan `SESSION_SECRET` hanya dipakai di server module. Cookie `ct_session` menggunakan `httpOnly: true`, `sameSite: "lax"`, dan `secure` di production. | Pertahankan konfigurasi eksisting tanpa mengubah alur `/api/auth/**`. |

---

## 3. Work Order Bertahap

### **[WO-01] Isolasi Data Penuh per Event (`eventId`) untuk Pembiayaan, Notulensi, Sections, Evaluasi & Live Logs | Assignee: NEON**
- **Prioritas:** `KRITIS`
- **File Target:**
  - `src/features/finance/finance-view.tsx`
  - `src/features/meeting-notes/meeting-notes-view.tsx`
  - `src/features/evaluation/evaluation-view.tsx`
  - `src/features/sections/sections-view.tsx`
  - `src/features/cue-cards/mc-cue-card-deck.tsx`
  - `src/features/proposal/proposal-builder-view.tsx`
  - `src/app/page.tsx`
- **Instruksi Teknis:**
  1. **Isolasi `eventId` di `FinanceView` (`src/features/finance/finance-view.tsx`):**
     - Filter `filteredBudgets` dengan kondisi `((b.event_id || INITIAL_EVENT.id) === activeEvent.id) && (sectionFilter === "ALL" || b.section === sectionFilter)` sehingga daftar pembelanjaan, **Total Estimasi**, **Total Realisasi (Aktual)**, dan **Selisih Anggaran** terpisah total antar-event dan aman untuk data lama tanpa `event_id`.
  2. **Isolasi `eventId` & Realtime Sync di `MeetingNotesView` & `EvaluationView`:**
     - Tambahkan prop `activeEvent?: Event` pada `MeetingNotesViewProps` (default `INITIAL_EVENT`) dan kirim `activeEvent={event}` dari `src/app/page.tsx`.
     - Simpan `event_id: activeEvent.id` di `handleAddNote`, dan filter `filteredNotes` berdasarkan `((n.event_id || INITIAL_EVENT.id) === activeEvent.id)`.
     - Tambahkan `publishSyncMessage("CT_MEETING_NOTES", nextNotes)` serta `subscribeSyncMessages` pada `MeetingNotesView` dan `EvaluationView`.
  3. **Isolasi `eventId` di `ProposalBuilderView`, `SectionsView`, `McCueCardDeck`, dan `src/app/page.tsx`:**
     - Filter `CT_SECTION_BUDGETS` per `activeEvent.id` di `ProposalBuilderView` saat menjalankan `handleSyncFromEvent`.
     - Filter `guides`, `decorItems`, `tools`, `shotlists`, dan `pddReferences` per `(item.event_id || INITIAL_EVENT.id) === activeEvent.id` di `SectionsView` dan `McCueCardDeck`.
     - Di `src/app/page.tsx`, hitung `eventLogs` terfilter berdasarkan `(l.event_id || INITIAL_EVENT.id) === event.id`, lalu gunakan untuk `openIncidentsCount` dan teruskan ke `HomeDashboardView`, `LiveStageView`, serta `EvaluationView`.
- **Kriteria Selesai:**
  - Mengganti Event aktif di dropdown Header pada Mobile maupun Desktop langsung menampilkan data Pembiayaan, Notulensi, Tools Seksi, dan Evaluasi milik Event tersebut saja tanpa tercampur dengan Event lain.

---

### **[WO-02] Hardening Keamanan: Server-Side RBAC Guard, Sanitasi URL Anti-XSS, & Anti-Tampering `localStorage` | Assignee: NEON**
- **Prioritas:** `KRITIS`
- **File Target:**
  - `src/lib/utils.ts`
  - `src/features/events/actions/event-actions.ts`
  - `src/providers/auth-provider.tsx`
  - `src/features/finance/finance-view.tsx`
  - `src/features/sections/sections-view.tsx`
  - `src/features/proposal/proposal-builder-view.tsx`
  - `src/lib/proposal/export-proposal-word.ts`
- **Instruksi Teknis:**
  1. **Sanitasi URL Anti-XSS (`src/lib/utils.ts`):**
     - Tambahkan `sanitizeHttpUrl(input?: string | null): string | null` menggunakan `new URL()` dan hanya izinkan `http:` serta `https:`. Terapkan pada `receipt_photo_url` (dan tampilkan link `"Lihat Nota"` yang aman di kartu Pembiayaan dengan `rel="noopener noreferrer"`), `driveRefUrl`, `cueImageUrl`, dan `decorImageUrl`.
  2. **Proteksi RBAC Server Actions (`src/features/events/actions/event-actions.ts`):**
     - Buat `verifyCreativeLeaderAccess()` berbasis `getServerSession()` yang menolak eksekusi jika `session` valid memiliki role selain `CREATIVE_LEADER` / `isSuperadmin`. Terapkan di `createEventAction`, `updateEventAction`, `assignRosterAction`, `rollRosterSectionAction`, dan `removeRosterAction`.
  3. **Anti-Tampering `localStorage` (`src/providers/auth-provider.tsx`):**
     - Tambahkan `reconcileUserWithCanonical(rawUser, users)` saat memuat `CT_CURRENT_USER` dari `localStorage` dan pada event listener `storage` sehingga `base_role` dan `is_superadmin` selalu mengikuti data resmi `INITIAL_USERS`.
- **Kriteria Selesai:**
  - Skema URL berbahaya (`javascript:`, `data:`) diblokir/diabaikan.
  - Manipulasi `base_role` di `localStorage` tidak dapat menaikkan hak akses UI.
  - Server Actions menolak mutasi dari sesi non-Creative Leader.

---

### **[WO-05] Mandatory Login Gate & Immersive Mobile-First Landing Page (Pure CSS/Tailwind) | Assignee: NEON & HYDROGEN**
- **Prioritas:** `KRITIS`
- **File Target:**
  - `src/providers/auth-provider.tsx` (NEON)
  - `src/app/page.tsx` (NEON & HYDROGEN)
  - `src/middleware.ts` (NEON)
  - `src/features/cue-cards/mc-cue-card-deck.tsx` (NEON)
  - `src/features/landing/immersive-landing-view.tsx` *(File Baru - HYDROGEN & NEON)*
  - `src/app/globals.css` (HYDROGEN)
- **Instruksi Teknis:**
  1. **Wajib Login Sebelum Masuk / Mandatory Login Gate (NEON):**
     - **Hapus Auto-Login Default User:** Di `src/providers/auth-provider.tsx` (`loadSession`), jika tidak ada sesi valid di `/api/auth/me` maupun `CT_CURRENT_USER` di `localStorage`, set `currentUser` menjadi `null` (JANGAN fallback ke `INITIAL_USERS[0]`). Di `src/app/page.tsx`, inisialisasi state `currentUser` menjadi `null` dan sinkronkan langsung dengan `{ currentUser, isLoading } = useAuth()`.
     - **Splash / Loading Guard Anti-Flash:** Saat `isLoading` bernilai `true` pada `/`, tampilkan *Splash Screen* ringan berlogo Creative Team + spinner halus agar konten Workspace/Dashboard maupun Landing Page tidak berkedip (*flash*).
     - **Gate di `/`:** Jika `!isLoading && !currentUser`, `src/app/page.tsx` **HANYA** merender `<ImmersiveLandingView />` + `<PinLoginModal />` — seluruh Sidebar, Header Dashboard, BottomNav, maupun data event **tidak dirender sama sekali** ke DOM sebelum user berhasil login PIN.
     - **Proteksi Route Internal (`/events/**` & `/cue-cards`):**
       - Perbarui `src/middleware.ts`: tambahkan `"/cue-cards"` ke `PROTECTED_PREFIXES` dan `config.matcher` (`["/events/:path*", "/cue-cards/:path*"]`) agar akses langsung tanpa cookie sesi otomatis diarahkan ke halaman login/landing (`/?redirect=...` atau `/login?redirect=...`).
       - Di `McCueCardDeck`, baca `useAuth()` (`currentUser`, `isLoading`) dan tampilkan layar kunci *"Login Diperlukan"* jika `!isLoading && !currentUser`.
     - Pertahankan 100% endpoint `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, dan `PinLoginForm`.
  2. **Immersive Mobile-First Landing Page (`src/features/landing/immersive-landing-view.tsx` & `src/app/globals.css` - HYDROGEN):**
     - **Atmosfer & Kedalaman Visual (Pure CSS/Tailwind, 60fps):**
       - Tambahkan keyframe GPU-accelerated ringan (`@keyframes floatOrbSlow`, `@keyframes shimmerSweep`, `@keyframes pulseRing`) di `globals.css` dengan hanya menganimasikan `transform` dan `opacity` serta dukungan `@media (prefers-reduced-motion: reduce)`.
       - Latar belakang hero memakai kombinasi *ambient mesh gradient* selaras warna brand prism Creative Team (Indigo, Violet, Cyan, Amber, Rose dengan opacity rendah agar tetap bersih & cerah), *subtle dot-grid pattern*, dan kartu *glassmorphism* (`bg-white/75 backdrop-blur-md border-white/60 shadow-xl`).
     - **Hero Section + Interactive Live Command Preview:**
       - Navbar atas minimalis: `<BrandLogo />`, nama **Creative Team — Church Event OS**, dan tombol cepat **"Masuk"** (`onOpenLogin`).
       - Hero kiri (atau atas di mobile): *Status pill* berdenyut (`LIVE OPERATIONS READY`), judul *bold* dengan aksen gradien (`Satu Command Center untuk Pelayanan Kreatif yang Presisi`), deskripsi ringkas, dan tombol CTA utama **"Masuk ke Workspace"** (efek *hover glow/shimmer*) untuk membuka Modal Login PIN.
       - Hero kanan (atau bawah di mobile): **Interactive Live Command Preview** — kartu mockup Live Stage interaktif yang menampilkan indikator `LIVE` berkedip, simulasi *timer* detik yang berjalan nyata (`useEffect` ringan di dalam komponen preview), tombol interaktif kecil untuk mengganti simulasi segmen (`Praise & Worship` / `Firman Tuhan` / `Candle Light`) langsung di Landing Page, serta *floating pills* seksi (`ACARA`, `DEKORASI`, `PERLENGKAPAN`, `PDD`) yang melayang halus.
     - **Bento Grid Fitur & Micro-Interactions:**
       - 4 kartu Bento Grid responsif (`grid-cols-1 md:grid-cols-12`) dengan *hover lift* (`hover:-translate-y-1 transition-all duration-200`), *border glow*, dan *staggered entrance animation*:
         1. **Real-Time Live Stage Sync** (Multi-device master clock, CUE alert 3 menit, Change Queue instan).
         2. **Multi-Section & Role Command (RBAC)** (Ruang kerja khusus Acara + Cue Card MC, Dekorasi, Perlengkapan, PDD, Pembiayaan Bendahara, dan Notulensi Sekretaris).
         3. **Perencanaan Timeline, Kalender & Proposal Word** (Matriks jadwal bulanan, kalender terpadu, dan generator Proposal Event langsung ke `.doc`).
         4. **Evaluasi Pasca-Acara & Isolasi Event** (Pencatatan insiden, pelaporan LPJ otomatis, dan isolasi penuh data antar-event).
     - **Responsivitas Mobile (`360px`+):** Pastikan seluruh container menggunakan `overflow-x-hidden`, padding aman untuk layar HP, ukuran font responsif (`text-3xl sm:text-5xl`), dan CTA mudah dijangkau jempol.
- **Kriteria Selesai:**
  - Saat membuka `/` atau `/events` atau `/cue-cards` dalam kondisi belum login, pengguna tidak dapat melihat Dashboard atau data event apa pun dan langsung disambut **Immersive Landing Page** dengan tombol login PIN.
  - Setelah login via PIN (baik di Mobile maupun Desktop), user langsung masuk ke Workspace sesuai role-nya; dan saat Logout, kembali terkunci di Landing Page.
  - Tidak ada library animasi berat terpasang, 0 horizontal overflow di layar HP `360px`, dan `npx tsc --noEmit` + `npm run build` lulus **0 Error**.

---

### **[WO-03] Sinkronisasi Daftar Event di `/events` (`EventListView`) & Penyempurnaan E2E | Assignee: NEON & HYDROGEN**
- **Prioritas:** `SEDANG`
- **File Target:**
  - `src/features/events/event-list-view.tsx`
- **Instruksi Teknis:**
  - Di `EventListView`, gabungkan (*merge*) `initialEvents` dari server dengan pembaruan dari `localStorage.getItem("CT_EVENTS")` (beserta lookup `event_leader` dari `INITIAL_USERS`) dan dengarkan `subscribeSyncMessages` sehingga event baru dan perubahan status (`DRAFT` -> `POST_EVENT` -> `COMPLETED`) selalu sinkron antara `/events` dan Workspace Utama (`/`).
- **Kriteria Selesai:**
  - Event baru dari `/events/new` maupun perubahan status di `/` konsisten tampil di `/events` di Mobile & Desktop.

---

### **[WO-04] Transisi Simpel & Halus pada Perpindahan Tab, Sub-Tab, dan Halaman (Pure CSS/Tailwind) | Assignee: HYDROGEN**
- **Prioritas:** `RENDAH`
- **File Target:**
  - `src/app/globals.css`
  - `src/app/page.tsx`
  - `src/features/sections/sections-view.tsx`
  - `src/features/proposal/proposal-builder-view.tsx`
  - `src/app/(dashboard)/events/page.tsx`
  - `src/app/(dashboard)/events/new/page.tsx`
  - `src/app/(dashboard)/events/[id]/page.tsx`
  - `src/app/(dashboard)/cue-cards/page.tsx`
- **Instruksi Teknis:**
  1. Definisikan keyframe `tabSlideFadeIn` (`200ms cubic-bezier(0.22, 1, 0.36, 1)`) pada class `.animate-tab-enter` di `src/app/globals.css`, lengkap dengan `@media (prefers-reduced-motion: reduce)`.
  2. Terapkan wrapper `<div key={`${activeTab}-${event.id}`} className="animate-tab-enter">` pada render konten tab aktif di `src/app/page.tsx`, serta `key={activeSection}`, `key={acaraSubTab}`, dan `key={step}` dengan kelas `animate-tab-enter` di `SectionsView` dan `ProposalBuilderView`.
  3. Tambahkan `.animate-tab-enter` pada kontainer utama route `/events`, `/events/new`, `/events/[id]`, dan `/cue-cards`.
- **Kriteria Selesai:**
  - Transisi antar-tab, sub-tab, pergantian event, dan halaman terasa mulus (`200ms`), tanpa layout shift dan tanpa menambah beban bundle JS, serta lulus `npx tsc --noEmit` & `npm run build` (**0 Error**).
