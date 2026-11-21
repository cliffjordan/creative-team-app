import { sanitizeHttpUrl } from "@/lib/utils";
import type {
  Event,
  EventBudgetLedgerItem,
  EventCommitteeMember,
  EventMinisterRow,
  RundownItem,
} from "@/types/domain";

export interface BriefDecorItem {
  name: string;
  qty: string;
  description: string;
}

export interface BriefEquipmentItem {
  name: string;
  qty: string;
  purpose: string;
  priority: "High" | "Med" | "Low" | string;
}

export interface BriefBudgetOverviewRow {
  category: string;
  estimated: number;
  actual: number;
  status: string;
}

export interface BriefBudgetDetailRow {
  sectionLabel: string;
  itemName: string;
  requiredDate: string;
  qty: number;
  uom: string;
  unitPrice: number;
  estimatedAmount: number;
  notes: string;
}

export interface BriefCommitteeRow {
  role: string;
  pic: string;
  contact: string;
}

export interface BriefMinisterRow {
  role: string;
  members: string;
  notes: string;
}

export interface BriefRundownRow {
  time: string;
  duration: string;
  activity: string;
  pic: string;
  notes: string;
}

export interface BriefApprovalRow {
  role: string;
  name: string;
  date: string;
}

export interface EventProjectBriefData {
  // Cover
  eventName: string;
  mainTheme: string;
  scriptureRef: string;
  scriptureQuote: string;
  eventDate: string;
  eventTime: string;
  location: string;

  // 01. Project Overview
  tagline: string;
  background: string;
  keyMessage: string;
  objectives: string;
  targetAudience: string;
  coreConcept: string;

  // 02. Event Experience & Participant Journey
  desiredAtmosphere: string;
  journeyBefore: string;
  journeyArrival: string;
  journeyOpening: string;
  journeyMain: string;
  journeyClosing: string;
  journeyAfter: string;

  // 03A. Section Acara
  acaraConcept: string;
  acaraProgram: string;
  acaraSpecialMoment: string;
  acaraTalent: string;
  acaraDuration: string;
  acaraSpecialReq: string;

  // 03B. Section Dekorasi
  decorConcept: string;
  decorStyle: string;
  decorPalette: string;
  decorKeyVisual: string;
  decorAreas: string;
  decorSpecialReq: string;
  decorImageUrl: string;
  decorItems: BriefDecorItem[];

  // 03C. Section Perlengkapan & Teknis
  equipmentItems: BriefEquipmentItem[];
  techRequirements: string;

  // 03D. Section Dokumentasi
  docObjective: string;
  docContent: string;
  docShotlist: string;
  docPlatforms: string;
  docTarget: string;

  // 04. Budget Overview + Gambar 1 Rincian
  budgetOverview: BriefBudgetOverviewRow[];
  budgetDetails: BriefBudgetDetailRow[];

  // 05. Key People & PIC (Struktur Panitia)
  orgChartUrl: string;
  committee: BriefCommitteeRow[];

  // 06. Daftar Pelayan Acara
  ministers: BriefMinisterRow[];

  // 07. Susunan Acara (Rundown)
  rundownTotalDuration: string;
  rundownOpenGate: string;
  rundownStartTime: string;
  rundownEndTime: string;
  rundown: BriefRundownRow[];

  // 08. Teknis Pelaksanaan
  techEvent1: string;
  techEvent2: string;
  techEvent3: string;
  techSpecial1: string;
  techSpecial2: string;
  techSpecial3: string;
  techPerf1: string;
  techPerf2: string;
  techPerf3: string;

  // 09. Approval & Final Creative Direction
  approvals: BriefApprovalRow[];
  finalCreativeDirection: string;
}

const DEFAULT_OVERVIEW_CATEGORIES = [
  "Acara",
  "Dekorasi",
  "Perlengkapan",
  "Dokumentasi",
  "Kado / Apresiasi",
  "Konsumsi",
  "Multimedia",
  "Lain-lain / Contingency",
];

export function createDefaultBriefForEvent(event: Event): EventProjectBriefData {
  const formattedDate = event.event_date
    ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Tanggal Acara";

  const theme = event.theme || "Tema Utama Acara";

  return {
    eventName: event.title || "Nama Acara & Tahun",
    mainTheme: theme,
    scriptureRef: "Efesus 5:10",
    scriptureQuote: "Berusahalah mengenal apa yang menyenangkan hati Tuhan.",
    eventDate: formattedDate,
    eventTime: "16.00 WIB",
    location: "Gedung Utama Gereja",

    tagline: "Bersinar & Melayani Bersama",
    background: `Latar belakang penyelenggaraan ${event.title || "acara ini"} serta peran strategis Creative Team dalam mempersiapkan pengalaman acara yang bermakna.`,
    keyMessage: "Setiap jemaat mengenal kasih Tuhan dan melayani dengan segenap hati.",
    objectives: "1. Mempersiapkan ibadah & perayaan dengan tertib.\n2. Menghadirkan suasana hangat & bermakna.\n3. Mengkoordinasikan seluruh seksi pelayanan secara sinkron.",
    targetAudience: "Jemaat, keluarga, remaja/pemuda, anak-anak, dan tamu undangan.",
    coreConcept: `Pendekatan visual dan alur acara terintegrasi mengusung tema "${theme}".`,

    desiredAtmosphere: "Warm • Joyful • Worshipful • Meaningful • Cinematic",
    journeyBefore: "Menerima teaser, undangan digital, dan informasi acara.",
    journeyArrival: "Disambut usher di entrance, registrasi kehadiran, dan menerima kit acara.",
    journeyOpening: "Countdown, video bumper pembuka, dan sambutan hangat oleh MC.",
    journeyMain: "Praise & Worship, Renungan/Firman, serta sesi penampilan/drama.",
    journeyClosing: "Refleksi, pengumuman, doa penutup, dan berkat.",
    journeyAfter: "Fellowship, sesi foto di photo booth, serta publikasi dokumentasi.",

    acaraConcept: "Alur acara tertata mengalir dari pembukaan hingga klimaks pesan utama.",
    acaraProgram: "Opening -> Welcome -> Worship -> Penampilan/Sesi Khusus -> Main Message -> Closing",
    acaraSpecialMoment: "Momen puncak penyalaan lilin / doa komitmen bersama jemaat.",
    acaraTalent: "MC (2 orang), Worship Leader, Singers, Tim Musik, Pengisi Acara",
    acaraDuration: "± 2,5 jam acara utama (termasuk open gate & fellowship)",
    acaraSpecialReq: "Cue sheet terpadu seluruh seksi & technical rehearsal H-1.",

    decorConcept: "Dekorasi backdrop panggung utama dengan pencahayaan hangat dan fokus tipografi tema.",
    decorStyle: "Cinematic, Warm, Modern, Clean",
    decorPalette: "Deep Navy (#0B2545), Warm Gold (#F59E0B), Clean White (#FFFFFF)",
    decorKeyVisual: "Tipografi judul tema pada main backdrop beserta pencahayaan neon flex.",
    decorAreas: "Main Stage, Entrance, Registration Area, Photo Booth, Main Hall",
    decorSpecialReq: "Backdrop utama aman terpasang H-1, warm lighting, signage arah entrance.",
    decorImageUrl: "",
    decorItems: [
      { name: "Backdrop Kain & Rangka Utama", qty: "1 Set", description: "Fokus latar belakang panggung" },
      { name: "Kain Sheer / Tile & Lampu Tumblr", qty: "1 Set", description: "Drapery lembut dan aksen cahaya hangat" },
    ],

    equipmentItems: [
      { name: "Sound System & Wireless Mic", qty: "1 Set", purpose: "Audio panggung & pembicara", priority: "High" },
      { name: "LED Wall / Proyektor + Laptop Cadangan", qty: "2 Unit", purpose: "Penayangan lirik, timer & video", priority: "High" },
    ],
    techRequirements: "Wajib check seluruh perangkat audio/visual pada technical rehearsal H-1, siapkan kabel cadangan dan HT komunikasi antar PIC.",

    docObjective: "Arsip dokumentasi acara, konten media sosial, highlight reel, dan aftermovie.",
    docContent: "Foto liputan acara, video klip pendek (Reels), foto grup pelayan, dan BTS.",
    docShotlist: "1. Venue & Dekorasi sebelum open gate | 2. Opening | 3. Praise & Worship | 4. Sesi Firman | 5. Foto Grup",
    docPlatforms: "Instagram, TikTok, YouTube, WhatsApp Jemaat",
    docTarget: "Min. 80 foto terpilih, 1 highlight reel 60-90 dtk, 1 aftermovie.",

    budgetOverview: DEFAULT_OVERVIEW_CATEGORIES.map((category) => ({
      category,
      estimated: 0,
      actual: 0,
      status: "Planning",
    })),
    budgetDetails: [],

    orgChartUrl: "",
    committee: [],
    ministers: [],

    rundownTotalDuration: "150 Menit (2 Jam 30 Menit)",
    rundownOpenGate: "15.30 WIB",
    rundownStartTime: "16.00 WIB",
    rundownEndTime: "18.30 WIB",
    rundown: [],

    techEvent1: "1. Usher menyambut peserta di entrance, mencatat absensi, dan membagikan perlengkapan acara.",
    techEvent2: "2. Pengaturan area tempat duduk peserta & pendamping/orang tua sesuai zona.",
    techEvent3: "3. Koordinasi ketertiban bersama Floor Director selama ibadah berlangsung.",
    techSpecial1: "1. Urutan pemanggilan perwakilan / alur masuk panggung diatur oleh MC & Stage Manager.",
    techSpecial2: "2. Lagu pengiring dan penyerahan properti disiapkan 2 segmen sebelumnya.",
    techSpecial3: "3. Operator lighting & multimedia mengeksekusi cue sesuai ketukan timer panggung.",
    techPerf1: "1. Pengarahan MC kepada jemaat sebelum sesi penampilan dimulai.",
    techPerf2: "2. Transisi cepat antar penampil dipandu Floor Director dan Stage Crew.",
    techPerf3: "3. Pengumuman penutup & koordinasi sesi foto grup di akhir acara.",

    approvals: [
      { role: "Ketua Panitia", name: "-", date: "" },
      { role: "Wakil Ketua Panitia", name: "-", date: "" },
      { role: "Kakak Pemerhati / Pembina", name: "-", date: "" },
    ],
    finalCreativeDirection: `Setelah disetujui, "${theme}" menjadi creative direction utama. Seksi Acara, Dekorasi, Perlengkapan, dan Dokumentasi wajib menjaga konsistensi pesan, visual, dan pengalaman peserta di seluruh rangkaian acara.`,
  };
}

const SECTION_LABEL_FOR_DOC: Record<string, string> = {
  DEKORASI: "Sie. Dekorasi",
  ACARA: "Sie. Acara",
  PERLENGKAPAN: "Sie. Perlengkapan",
  PDD: "Sie. Dokumentasi & Multimedia",
  INTI: "Pengeluaran Inti",
  ALL: "Lain-lain",
};

export function mergeSyncedEventDataIntoBrief(
  current: EventProjectBriefData,
  params: {
    event: Event;
    budgets: EventBudgetLedgerItem[];
    committee: EventCommitteeMember[];
    ministers: EventMinisterRow[];
    rundownItems: RundownItem[];
  }
): EventProjectBriefData {
  const { event, budgets, committee, ministers, rundownItems } = params;

  // Map Budget Overview categories
  const overviewMap = new Map<string, { estimated: number; actual: number; statuses: string[] }>();
  for (const cat of DEFAULT_OVERVIEW_CATEGORIES) {
    overviewMap.set(cat, { estimated: 0, actual: 0, statuses: [] });
  }

  for (const item of budgets) {
    const fallbackCat =
      item.section === "ACARA"
        ? "Acara"
        : item.section === "DEKORASI"
        ? "Dekorasi"
        : item.section === "PERLENGKAPAN"
        ? "Perlengkapan"
        : item.section === "PDD"
        ? "Dokumentasi"
        : "Lain-lain / Contingency";
    const key = item.budget_category && overviewMap.has(item.budget_category)
      ? item.budget_category
      : fallbackCat;
    const entry = overviewMap.get(key) ?? { estimated: 0, actual: 0, statuses: [] };
    entry.estimated += Number(item.estimated_amount) || 0;
    entry.actual += Number(item.actual_amount) || 0;
    if (item.budget_status) entry.statuses.push(item.budget_status);
    overviewMap.set(key, entry);
  }

  const nextBudgetOverview: BriefBudgetOverviewRow[] = Array.from(overviewMap.entries()).map(
    ([category, val]) => ({
      category,
      estimated: val.estimated,
      actual: val.actual,
      status: val.statuses.includes("Paid")
        ? "Paid"
        : val.statuses.includes("Approved") || val.estimated > 0
        ? "Approved"
        : "Planning",
    })
  );

  const nextBudgetDetails: BriefBudgetDetailRow[] = budgets.map((b) => ({
    sectionLabel: SECTION_LABEL_FOR_DOC[b.section] || b.section,
    itemName: b.item_name,
    requiredDate: b.required_date
      ? new Date(`${b.required_date}T00:00:00`).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-",
    qty: b.quantity ?? 1,
    uom: b.uom || "Set",
    unitPrice: b.unit_price ?? b.estimated_amount ?? 0,
    estimatedAmount: b.estimated_amount ?? 0,
    notes: b.notes || "-",
  }));

  const nextCommittee: BriefCommitteeRow[] =
    committee.length > 0
      ? committee.map((c) => ({
          role: c.position_name,
          pic: c.pic_name,
          contact: c.contact_notes || "-",
        }))
      : current.committee;

  const nextMinisters: BriefMinisterRow[] =
    ministers.length > 0
      ? ministers.map((m) => ({
          role: m.ministry_role,
          members: m.minister_names,
          notes: m.notes || "-",
        }))
      : current.ministers;

  const totalMins = rundownItems.reduce(
    (sum, it) => sum + (Number(it.estimated_duration_minutes) || 0),
    0
  );
  const nextRundown: BriefRundownRow[] =
    rundownItems.length > 0
      ? rundownItems.map((it, idx) => ({
          time: it.planned_start_time || `Segmen ${idx + 1}`,
          duration: `${it.estimated_duration_minutes} menit`,
          activity: it.title,
          pic: it.section_pic,
          notes: it.technical_notes || "-",
        }))
      : current.rundown;

  return {
    ...current,
    eventName: event.title || current.eventName,
    mainTheme: event.theme || current.mainTheme,
    budgetOverview: budgets.length > 0 ? nextBudgetOverview : current.budgetOverview,
    budgetDetails: budgets.length > 0 ? nextBudgetDetails : current.budgetDetails,
    committee: nextCommittee,
    ministers: nextMinisters,
    rundown: nextRundown,
    rundownTotalDuration:
      totalMins > 0
        ? `${totalMins} Menit (${Math.floor(totalMins / 60)} Jam ${totalMins % 60} Menit)`
        : current.rundownTotalDuration,
  };
}

function formatRupiah(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)}`;
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function exportProjectBriefToDocx(
  eventId: string,
  data: EventProjectBriefData
): Promise<void> {
  const res = await fetch(`/api/events/${eventId}/document/export-docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Gagal menghasilkan dokumen Word (.docx)");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.eventName || "Event-Project-Brief")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")}-Brief.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProjectBriefToPdf(data: EventProjectBriefData): void {
  const safeDecorImg = sanitizeHttpUrl(data.decorImageUrl);
  const safeOrgUrl = sanitizeHttpUrl(data.orgChartUrl);
  const totalEst = data.budgetOverview.reduce((s, r) => s + (Number(r.estimated) || 0), 0);
  const totalAct = data.budgetOverview.reduce((s, r) => s + (Number(r.actual) || 0), 0);
  const totalDetail = data.budgetDetails.reduce((s, r) => s + (Number(r.estimatedAmount) || 0), 0);

  const printWin = window.open("", "_blank", "width=960,height=1100");
  if (!printWin) {
    alert("Popup diblokir browser. Izinkan popup untuk menyimpan/mencetak dokumen PDF.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Event Project Brief - ${escapeHtml(data.eventName)}</title>
<style>
  @page { size: A4; margin: 22mm 14mm 18mm 22mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #0f172a;
    margin: 0;
  }
  .cover {
    border-top: 6px solid #0B2545;
    border-bottom: 3px solid #31849B;
    padding: 48px 28px;
    background: #F8FAFC;
    margin-bottom: 24px;
    page-break-after: always;
    text-align: center;
  }
  .cover-tag { font-size: 10pt; letter-spacing: 3px; color: #31849B; font-weight: bold; }
  .cover-title { font-size: 26pt; color: #0B2545; font-weight: 800; margin: 14px 0 6px; }
  .cover-theme { font-size: 16pt; color: #31849B; font-weight: 700; margin-bottom: 18px; }
  .cover-verse { font-style: italic; color: #475569; max-width: 520px; margin: 0 auto 24px; }
  .cover-meta { font-size: 10.5pt; font-weight: 700; color: #0B2545; }
  .cover-prep { margin-top: 40px; font-size: 9pt; letter-spacing: 2px; color: #64748B; }
  .sec-title {
    font-size: 12.5pt;
    font-weight: 800;
    color: #0B2545;
    border-bottom: 2px solid #31849B;
    padding-bottom: 4px;
    margin: 20px 0 10px;
    page-break-after: avoid;
  }
  .sub-title { font-size: 10.5pt; font-weight: 700; color: #0B2545; margin: 12px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.2pt; }
  th, td { border: 1px solid #CBD5E1; padding: 6px 8px; vertical-align: top; }
  th { background: #0B2545; color: #FFFFFF; font-weight: 700; text-align: left; }
  .kv-key { width: 32%; background: #F0F6FA; font-weight: 700; color: #0B2545; }
  .total-row td { background: #F8FAFC; font-weight: 800; color: #0B2545; }
  .group-row td { background: #F0F6FA; font-weight: 800; color: #0B2545; }
  .num { text-align: right; font-family: Consolas, monospace; }
  .center { text-align: center; }
  p { margin: 0 0 6px; whitespace: pre-line; }
  .footer-bar {
    margin-top: 24px;
    background: #0B2545;
    color: #FFFFFF;
    padding: 8px 12px;
    font-size: 8.5pt;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-tag">EVENT PROJECT BRIEF • EVENT PLANNING &amp; EXECUTION</div>
    <div class="cover-title">${escapeHtml(data.eventName)}</div>
    <div class="cover-theme">${escapeHtml(data.mainTheme)}</div>
    <div class="cover-verse">
      <strong>${escapeHtml(data.scriptureRef)}</strong><br/>
      &ldquo;${escapeHtml(data.scriptureQuote)}&rdquo;
    </div>
    <div class="cover-meta">${escapeHtml(data.eventDate)} &nbsp;|&nbsp; ${escapeHtml(data.eventTime)}</div>
    <div class="cover-meta" style="margin-top:4px; color:#31849B;">${escapeHtml(data.location)}</div>
    <div class="cover-prep">PREPARED BY CREATIVE TEAM</div>
  </div>

  <div class="sec-title">01. PROJECT OVERVIEW</div>
  <table>
    <tr><td class="kv-key">Main Theme</td><td>${escapeHtml(data.mainTheme)}</td></tr>
    <tr><td class="kv-key">Scripture / Biblical Foundation</td><td>${escapeHtml(data.scriptureRef)} — "${escapeHtml(data.scriptureQuote)}"</td></tr>
    <tr><td class="kv-key">Tagline</td><td>${escapeHtml(data.tagline)}</td></tr>
    <tr><td class="kv-key">Background</td><td style="white-space:pre-line;">${escapeHtml(data.background)}</td></tr>
    <tr><td class="kv-key">Key Message</td><td>${escapeHtml(data.keyMessage)}</td></tr>
    <tr><td class="kv-key">Project Objectives</td><td style="white-space:pre-line;">${escapeHtml(data.objectives)}</td></tr>
    <tr><td class="kv-key">Target Audience</td><td>${escapeHtml(data.targetAudience)}</td></tr>
    <tr><td class="kv-key">Core Concept</td><td style="white-space:pre-line;">${escapeHtml(data.coreConcept)}</td></tr>
  </table>

  <div class="sec-title">02. EVENT EXPERIENCE &amp; PARTICIPANT JOURNEY</div>
  <table><tr><td class="kv-key">Desired Atmosphere</td><td>${escapeHtml(data.desiredAtmosphere)}</td></tr></table>
  <table>
    <thead><tr><th style="width:55px;" class="center">Tahap</th><th style="width:140px;">Fase</th><th>Pengalaman Peserta (Participant Journey)</th></tr></thead>
    <tbody>
      <tr><td class="center">1</td><td><strong>Before Event</strong></td><td>${escapeHtml(data.journeyBefore)}</td></tr>
      <tr><td class="center">2</td><td><strong>Arrival</strong></td><td>${escapeHtml(data.journeyArrival)}</td></tr>
      <tr><td class="center">3</td><td><strong>Opening</strong></td><td>${escapeHtml(data.journeyOpening)}</td></tr>
      <tr><td class="center">4</td><td><strong>Main Experience</strong></td><td>${escapeHtml(data.journeyMain)}</td></tr>
      <tr><td class="center">5</td><td><strong>Closing</strong></td><td>${escapeHtml(data.journeyClosing)}</td></tr>
      <tr><td class="center">6</td><td><strong>After Event</strong></td><td>${escapeHtml(data.journeyAfter)}</td></tr>
    </tbody>
  </table>

  <div class="sec-title">03A. SECTION — ACARA</div>
  <table>
    <tr><td class="kv-key">Main Concept</td><td>${escapeHtml(data.acaraConcept)}</td></tr>
    <tr><td class="kv-key">Activity / Program</td><td>${escapeHtml(data.acaraProgram)}</td></tr>
    <tr><td class="kv-key">Special Moment</td><td>${escapeHtml(data.acaraSpecialMoment)}</td></tr>
    <tr><td class="kv-key">Talent / Speaker / Performer</td><td>${escapeHtml(data.acaraTalent)}</td></tr>
    <tr><td class="kv-key">Estimated Duration</td><td>${escapeHtml(data.acaraDuration)}</td></tr>
    <tr><td class="kv-key">Special Requirements</td><td>${escapeHtml(data.acaraSpecialReq)}</td></tr>
  </table>

  <div class="sec-title">03B. SECTION — DEKORASI</div>
  <table>
    <tr><td class="kv-key">Decoration Concept</td><td>${escapeHtml(data.decorConcept)}</td></tr>
    <tr><td class="kv-key">Visual Style</td><td>${escapeHtml(data.decorStyle)}</td></tr>
    <tr><td class="kv-key">Color Palette</td><td>${escapeHtml(data.decorPalette)}</td></tr>
    <tr><td class="kv-key">Main Visual / Key Visual</td><td>${escapeHtml(data.decorKeyVisual)}</td></tr>
    <tr><td class="kv-key">Decoration Areas</td><td>${escapeHtml(data.decorAreas)}</td></tr>
    <tr><td class="kv-key">Special Requirements</td><td>${escapeHtml(data.decorSpecialReq)}</td></tr>
  </table>
  <div class="sub-title">Visualisasi Dekorasi</div>
  <table><tr><td>${safeDecorImg ? `Mockup: ${escapeHtml(safeDecorImg)}` : "[Gambar Referensi / Mockup Dekorasi Panggung]"}</td></tr></table>
  <div class="sub-title">Daftar Kebutuhan Item Dekorasi</div>
  <table>
    <thead><tr><th style="width:42px;" class="center">No.</th><th style="width:200px;">Item Dekorasi</th><th style="width:70px;" class="center">Qty</th><th>Keterangan / Fungsi</th></tr></thead>
    <tbody>
      ${data.decorItems.map((d, idx) => `<tr><td class="center">${idx + 1}</td><td>${escapeHtml(d.name)}</td><td class="center">${escapeHtml(d.qty)}</td><td>${escapeHtml(d.description)}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="sec-title">03C. SECTION — PERLENGKAPAN &amp; TEKNIS</div>
  <table>
    <thead><tr><th style="width:42px;" class="center">No.</th><th style="width:180px;">Equipment / Peralatan</th><th style="width:70px;" class="center">Qty</th><th>Purpose / Kegunaan</th><th style="width:85px;" class="center">Priority</th></tr></thead>
    <tbody>
      ${data.equipmentItems.map((e, idx) => `<tr><td class="center">${idx + 1}</td><td>${escapeHtml(e.name)}</td><td class="center">${escapeHtml(e.qty)}</td><td>${escapeHtml(e.purpose)}</td><td class="center">${escapeHtml(e.priority)}</td></tr>`).join("")}
    </tbody>
  </table>
  <table><tr><td><strong>Special Technical Requirements</strong><br/>${escapeHtml(data.techRequirements)}</td></tr></table>

  <div class="sec-title">03D. SECTION — DOKUMENTASI</div>
  <table>
    <tr><td class="kv-key">Documentation Objective</td><td>${escapeHtml(data.docObjective)}</td></tr>
    <tr><td class="kv-key">Required Content</td><td>${escapeHtml(data.docContent)}</td></tr>
    <tr><td class="kv-key">Priority Moments (Shot List)</td><td>${escapeHtml(data.docShotlist)}</td></tr>
    <tr><td class="kv-key">Publication Platforms</td><td>${escapeHtml(data.docPlatforms)}</td></tr>
    <tr><td class="kv-key">Output Target</td><td>${escapeHtml(data.docTarget)}</td></tr>
  </table>

  <div class="sec-title">04. BUDGET OVERVIEW</div>
  <table>
    <thead><tr><th>Kategori</th><th class="num">Estimasi Anggaran</th><th class="num">Realisasi (Actual)</th><th class="center">Status</th></tr></thead>
    <tbody>
      ${data.budgetOverview.map((b) => `<tr><td>${escapeHtml(b.category)}</td><td class="num">${formatRupiah(b.estimated)}</td><td class="num">${b.actual > 0 ? formatRupiah(b.actual) : "—"}</td><td class="center">${escapeHtml(b.status)}</td></tr>`).join("")}
      <tr class="total-row"><td>TOTAL ESTIMASI</td><td class="num">${formatRupiah(totalEst)}</td><td class="num">${totalAct > 0 ? formatRupiah(totalAct) : "—"}</td><td class="center">Synced</td></tr>
    </tbody>
  </table>

  ${data.budgetDetails.length > 0 ? `
  <div class="sub-title">Estimasi Keperluan Budget Rinci</div>
  <table>
    <thead><tr><th>Keperluan</th><th class="center">Tgl Diperlukan</th><th class="center">Qty</th><th class="center">UOM</th><th class="num">Harga Satuan</th><th class="num">Total</th><th>Keterangan</th></tr></thead>
    <tbody>
      ${data.budgetDetails.map((d) => `<tr><td style="white-space:pre-line;">${escapeHtml(d.itemName)}</td><td class="center">${escapeHtml(d.requiredDate)}</td><td class="center">${d.qty}</td><td class="center">${escapeHtml(d.uom)}</td><td class="num">${formatRupiah(d.unitPrice)}</td><td class="num"><strong>${formatRupiah(d.estimatedAmount)}</strong></td><td>${escapeHtml(d.notes)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="5" class="center">Total Rincian</td><td class="num">${formatRupiah(totalDetail)}</td><td></td></tr>
    </tbody>
  </table>` : ""}

  <div class="sec-title">05. KEY PEOPLE &amp; PIC (STRUKTUR PANITIA)</div>
  <table><tr><td>${safeOrgUrl ? `Bagan Organisasi: ${escapeHtml(safeOrgUrl)}` : "[Struktur Organisasi Panitia Event]"}</td></tr></table>
  <table>
    <thead><tr><th style="width:32%;">Jabatan / Seksi</th><th style="width:34%;">Penanggung Jawab (PIC)</th><th>Kontak / Catatan</th></tr></thead>
    <tbody>
      ${(data.committee.length > 0 ? data.committee : [{ role: "-", pic: "Belum diisi di menu Sekretariat", contact: "-" }]).map((c) => `<tr><td><strong>${escapeHtml(c.role)}</strong></td><td>${escapeHtml(c.pic)}</td><td>${escapeHtml(c.contact)}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="sec-title">06. DAFTAR PELAYAN ACARA</div>
  <table>
    <thead><tr><th style="width:30%;">Posisi / Tim</th><th style="width:42%;">Nama Pelayan</th><th>Keterangan</th></tr></thead>
    <tbody>
      ${(data.ministers.length > 0 ? data.ministers : [{ role: "-", members: "Belum diisi di menu Sekretariat", notes: "-" }]).map((m) => `<tr><td><strong>${escapeHtml(m.role)}</strong></td><td>${escapeHtml(m.members)}</td><td>${escapeHtml(m.notes)}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="sec-title">07. SUSUNAN ACARA (RUNDOWN)</div>
  <table>
    <thead><tr><th>Total Durasi Acara</th><th>Jam Open Gate</th><th>Jam Mulai</th><th>Jam Selesai</th></tr></thead>
    <tbody><tr><td>${escapeHtml(data.rundownTotalDuration)}</td><td>${escapeHtml(data.rundownOpenGate)}</td><td>${escapeHtml(data.rundownStartTime)}</td><td>${escapeHtml(data.rundownEndTime)}</td></tr></tbody>
  </table>
  <table>
    <thead><tr><th style="width:95px;">Waktu</th><th style="width:75px;">Durasi</th><th>Kegiatan</th><th style="width:120px;">PIC</th><th>Keterangan / Catatan Teknis</th></tr></thead>
    <tbody>
      ${(data.rundown.length > 0 ? data.rundown : [{ time: "-", duration: "-", activity: "Belum ada segmen rundown", pic: "-", notes: "-" }]).map((r) => `<tr><td>${escapeHtml(r.time)}</td><td>${escapeHtml(r.duration)}</td><td><strong>${escapeHtml(r.activity)}</strong></td><td>${escapeHtml(r.pic)}</td><td>${escapeHtml(r.notes)}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="sec-title">08. TEKNIS PELAKSANAAN</div>
  <div class="sub-title">08.1 Teknis Acara &amp; Usher</div>
  <p>${escapeHtml(data.techEvent1)}</p><p>${escapeHtml(data.techEvent2)}</p><p>${escapeHtml(data.techEvent3)}</p>
  <div class="sub-title">08.2 Teknis Sesi Khusus</div>
  <p>${escapeHtml(data.techSpecial1)}</p><p>${escapeHtml(data.techSpecial2)}</p><p>${escapeHtml(data.techSpecial3)}</p>
  <div class="sub-title">08.3 Teknis Penampilan / Pengisi Acara</div>
  <p>${escapeHtml(data.techPerf1)}</p><p>${escapeHtml(data.techPerf2)}</p><p>${escapeHtml(data.techPerf3)}</p>

  <div class="sec-title">09. APPROVAL &amp; FINAL CREATIVE DIRECTION</div>
  <table>
    <thead><tr><th>Role</th><th>Name</th><th style="width:110px;">Sign</th><th style="width:90px;">Date</th></tr></thead>
    <tbody>
      ${data.approvals.map((a) => `<tr><td><strong>${escapeHtml(a.role)}</strong></td><td>${escapeHtml(a.name)}</td><td style="height:34px;"></td><td>${escapeHtml(a.date)}</td></tr>`).join("")}
    </tbody>
  </table>
  <table><tr><td><strong>Final Creative Direction</strong><br/>${escapeHtml(data.finalCreativeDirection)}</td></tr></table>

  <div class="footer-bar">
    <span>Creative Team Project | Brief&rsquo;s</span>
    <span>${escapeHtml(data.eventName)}</span>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
</body>
</html>`;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
