import { sanitizeHttpUrl } from "@/lib/utils";
import type {
  Event,
  EventBudgetLedgerItem,
  EventCommitteeMember,
  EventMinisterRow,
  RundownItem,
  TechnicalExecutionSection,
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

  // 08. Teknis Pelaksanaan (Dynamic + Legacy fallback fields)
  techEvent1: string;
  techEvent2: string;
  techEvent3: string;
  techSpecial1: string;
  techSpecial2: string;
  techSpecial3: string;
  techPerf1: string;
  techPerf2: string;
  techPerf3: string;
  technicalSections?: TechnicalExecutionSection[];

  // Dinamis seragam ala 08. Teknis Pelaksanaan (opsional, backward-compatible)
  overviewSections?: TechnicalExecutionSection[];
  atmosphereItems?: string[];
  journeySections?: TechnicalExecutionSection[];
  acaraSections?: TechnicalExecutionSection[];
  decorSections?: TechnicalExecutionSection[];
  techRequirementItems?: string[];
  pddSections?: TechnicalExecutionSection[];
  finalDirectionItems?: string[];

  // 09. Approval & Final Creative Direction
  approvals: BriefApprovalRow[];
  finalCreativeDirection: string;
}

function splitLegacyLines(raw: string | undefined): string[] {
  const normalized = String(raw ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resolveDynamicGroups(
  groups: TechnicalExecutionSection[] | undefined,
  legacyRows: Array<{ id: string; title: string; raw: string | undefined }>
): TechnicalExecutionSection[] {
  if (Array.isArray(groups) && groups.length > 0) {
    return groups;
  }
  return legacyRows.map((row) => ({
    id: row.id,
    title: row.title,
    items: splitLegacyLines(row.raw),
  }));
}

export function formatDocumentGroupItems(items: string[]): string {
  const valid = items.map((s) => String(s ?? "").trim()).filter((s) => s.length > 0);
  if (valid.length === 0) return "-";
  if (valid.length === 1) return valid[0];
  return valid
    .map((line, idx) => (/^(?:\d+[.)]\s|[-•]\s)/.test(line) ? line : `${idx + 1}. ${line}`))
    .join("\n");
}

function formatDateWIB(rawDate: string | undefined | null, fallback = "Tanggal Acara"): string {
  if (!rawDate) return fallback;
  const isoPrefix = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : null;
  const parsed = isoPrefix ? new Date(`${isoPrefix}T00:00:00+07:00`) : new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return String(rawDate);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function resolveOverviewSections(
  data: Partial<EventProjectBriefData>
): TechnicalExecutionSection[] {
  const scriptureCombined = [data.scriptureRef, data.scriptureQuote ? `"${data.scriptureQuote}"` : ""]
    .filter(Boolean)
    .join(" — ");
  return resolveDynamicGroups(data.overviewSections, [
    { id: "ov-theme", title: "Main Theme", raw: data.mainTheme },
    { id: "ov-scripture", title: "Scripture / Biblical Foundation", raw: scriptureCombined },
    { id: "ov-tagline", title: "Tagline", raw: data.tagline },
    { id: "ov-background", title: "Background", raw: data.background },
    { id: "ov-keymsg", title: "Key Message", raw: data.keyMessage },
    { id: "ov-objectives", title: "Project Objectives", raw: data.objectives },
    { id: "ov-audience", title: "Target Audience", raw: data.targetAudience },
    { id: "ov-concept", title: "Core Concept", raw: data.coreConcept },
  ]);
}

export function resolveAtmosphereItems(data: Partial<EventProjectBriefData>): string[] {
  if (Array.isArray(data.atmosphereItems) && data.atmosphereItems.length > 0) {
    return data.atmosphereItems;
  }
  return splitLegacyLines(data.desiredAtmosphere);
}

export function resolveJourneySections(
  data: Partial<EventProjectBriefData>
): TechnicalExecutionSection[] {
  return resolveDynamicGroups(data.journeySections, [
    { id: "jrn-1", title: "Before Event", raw: data.journeyBefore },
    { id: "jrn-2", title: "Arrival", raw: data.journeyArrival },
    { id: "jrn-3", title: "Opening", raw: data.journeyOpening },
    { id: "jrn-4", title: "Main Experience", raw: data.journeyMain },
    { id: "jrn-5", title: "Closing", raw: data.journeyClosing },
    { id: "jrn-6", title: "After Event", raw: data.journeyAfter },
  ]);
}

export function resolveAcaraSections(
  data: Partial<EventProjectBriefData>
): TechnicalExecutionSection[] {
  return resolveDynamicGroups(data.acaraSections, [
    { id: "acara-1", title: "Main Concept", raw: data.acaraConcept },
    { id: "acara-2", title: "Activity / Program", raw: data.acaraProgram },
    { id: "acara-3", title: "Special Moment", raw: data.acaraSpecialMoment },
    { id: "acara-4", title: "Talent / Speaker / Performer", raw: data.acaraTalent },
    { id: "acara-5", title: "Estimated Duration", raw: data.acaraDuration },
    { id: "acara-6", title: "Special Requirements", raw: data.acaraSpecialReq },
  ]);
}

export function resolveDecorSections(
  data: Partial<EventProjectBriefData>
): TechnicalExecutionSection[] {
  return resolveDynamicGroups(data.decorSections, [
    { id: "decor-1", title: "Decoration Concept", raw: data.decorConcept },
    { id: "decor-2", title: "Visual Style", raw: data.decorStyle },
    { id: "decor-3", title: "Color Palette", raw: data.decorPalette },
    { id: "decor-4", title: "Main Visual / Key Visual", raw: data.decorKeyVisual },
    { id: "decor-5", title: "Decoration Areas", raw: data.decorAreas },
    { id: "decor-6", title: "Special Requirements", raw: data.decorSpecialReq },
  ]);
}

export function resolveTechRequirementItems(data: Partial<EventProjectBriefData>): string[] {
  if (Array.isArray(data.techRequirementItems) && data.techRequirementItems.length > 0) {
    return data.techRequirementItems;
  }
  return splitLegacyLines(data.techRequirements);
}

export function resolvePddSections(
  data: Partial<EventProjectBriefData>
): TechnicalExecutionSection[] {
  return resolveDynamicGroups(data.pddSections, [
    { id: "pdd-1", title: "Documentation Objective", raw: data.docObjective },
    { id: "pdd-2", title: "Required Content", raw: data.docContent },
    { id: "pdd-3", title: "Priority Moments (Shot List)", raw: data.docShotlist },
    { id: "pdd-4", title: "Publication Platforms", raw: data.docPlatforms },
    { id: "pdd-5", title: "Output Target", raw: data.docTarget },
  ]);
}

export function resolveFinalDirectionItems(data: Partial<EventProjectBriefData>): string[] {
  if (Array.isArray(data.finalDirectionItems) && data.finalDirectionItems.length > 0) {
    return data.finalDirectionItems;
  }
  return splitLegacyLines(data.finalCreativeDirection);
}

export function resolveTechnicalSections(
  data: Partial<EventProjectBriefData>
): TechnicalExecutionSection[] {
  if (Array.isArray(data.technicalSections) && data.technicalSections.length > 0) {
    return data.technicalSections;
  }
  return [
    {
      id: "tech-group-1",
      title: "08.1 Teknis Acara & Usher",
      items: [data.techEvent1 || "", data.techEvent2 || "", data.techEvent3 || ""].filter(
        (s) => s.trim().length > 0
      ),
    },
    {
      id: "tech-group-2",
      title: "08.2 Teknis Sesi Khusus",
      items: [data.techSpecial1 || "", data.techSpecial2 || "", data.techSpecial3 || ""].filter(
        (s) => s.trim().length > 0
      ),
    },
    {
      id: "tech-group-3",
      title: "08.3 Teknis Penampilan / Pengisi Acara",
      items: [data.techPerf1 || "", data.techPerf2 || "", data.techPerf3 || ""].filter(
        (s) => s.trim().length > 0
      ),
    },
  ];
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
  const formattedDate = formatDateWIB(event.event_date, "Tanggal Acara");

  const theme = event.theme || "Tema Utama Acara";

  const baseBrief: EventProjectBriefData = {
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
    technicalSections: [
      {
        id: "tech-group-1",
        title: "08.1 Teknis Acara & Usher",
        items: [
          "1. Usher menyambut peserta di entrance, mencatat absensi, dan membagikan perlengkapan acara.",
          "2. Pengaturan area tempat duduk peserta & pendamping/orang tua sesuai zona.",
          "3. Koordinasi ketertiban bersama Floor Director selama ibadah berlangsung.",
        ],
      },
      {
        id: "tech-group-2",
        title: "08.2 Teknis Sesi Khusus",
        items: [
          "1. Urutan pemanggilan perwakilan / alur masuk panggung diatur oleh MC & Stage Manager.",
          "2. Lagu pengiring dan penyerahan properti disiapkan 2 segmen sebelumnya.",
          "3. Operator lighting & multimedia mengeksekusi cue sesuai ketukan timer panggung.",
        ],
      },
      {
        id: "tech-group-3",
        title: "08.3 Teknis Penampilan / Pengisi Acara",
        items: [
          "1. Pengarahan MC kepada jemaat sebelum sesi penampilan dimulai.",
          "2. Transisi cepat antar penampil dipandu Floor Director dan Stage Crew.",
          "3. Pengumuman penutup & koordinasi sesi foto grup di akhir acara.",
        ],
      },
    ],

    approvals: [
      { role: "Ketua Panitia", name: "-", date: "" },
      { role: "Wakil Ketua Panitia", name: "-", date: "" },
      { role: "Kakak Pemerhati / Pembina", name: "-", date: "" },
    ],
    finalCreativeDirection: `Setelah disetujui, "${theme}" menjadi creative direction utama. Seksi Acara, Dekorasi, Perlengkapan, dan Dokumentasi wajib menjaga konsistensi pesan, visual, dan pengalaman peserta di seluruh rangkaian acara.`,
  };

  return {
    ...baseBrief,
    overviewSections: resolveOverviewSections(baseBrief),
    atmosphereItems: resolveAtmosphereItems(baseBrief),
    journeySections: resolveJourneySections(baseBrief),
    acaraSections: resolveAcaraSections(baseBrief),
    decorSections: resolveDecorSections(baseBrief),
    techRequirementItems: resolveTechRequirementItems(baseBrief),
    pddSections: resolvePddSections(baseBrief),
    finalDirectionItems: resolveFinalDirectionItems(baseBrief),
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
    requiredDate: formatDateWIB(b.required_date, "-"),
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const leftMarginImg = `${origin}/templates/pdf-assets/margin-left.png`;
  const headerBandImg = `${origin}/templates/pdf-assets/header-band.png`;
  const footerLogoImg = `${origin}/templates/pdf-assets/footer-logo.png`;

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
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #0f172a;
    background: #FFFFFF;
  }

  /* Fixed Template Design Chrome repeating across every printed A4 page */
  .print-left-margin {
    position: fixed;
    top: 0;
    left: 0;
    width: 20mm;
    height: 297mm;
    z-index: 30;
    pointer-events: none;
  }
  .print-left-margin img {
    width: 20mm;
    height: 297mm;
    object-fit: cover;
    display: block;
  }
  .print-header {
    position: fixed;
    top: 0;
    left: 20mm;
    width: 190mm;
    height: 32.5mm;
    background: #FFFFFF;
    z-index: 20;
    pointer-events: none;
  }
  .print-header img {
    width: 190mm;
    height: 32.5mm;
    object-fit: contain;
    object-position: left top;
    display: block;
  }
  .print-footer {
    position: fixed;
    bottom: 0;
    left: 20mm;
    width: 190mm;
    height: 13mm;
    background: #0B2545;
    color: #FFFFFF;
    padding: 0 14mm 0 6mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 8.5pt;
    font-weight: 700;
    z-index: 25;
  }
  .print-footer-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .print-footer-left img {
    width: 7.5mm;
    height: 7.5mm;
    object-fit: contain;
    display: block;
  }

  /* Semantic print table wrapper reserves exact top/bottom spacers on all pages */
  table.print-shell {
    width: 100%;
    border-collapse: collapse;
    border: none;
    margin: 0;
  }
  table.print-shell > thead > tr > td,
  table.print-shell > tfoot > tr > td,
  table.print-shell > tbody > tr > td.print-body {
    border: none;
    padding: 0;
  }
  .header-spacer {
    height: 36mm;
  }
  .footer-spacer {
    height: 17mm;
  }
  td.print-body {
    padding: 0 14mm 0 25.5mm !important;
  }

  /* Screen preview comfort */
  @media screen {
    body {
      background: #E2E8F0;
      padding: 16px 0;
    }
    table.print-shell {
      width: 210mm;
      margin: 0 auto;
      background: #FFFFFF;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
    }
  }

  .cover {
    border-top: 5px solid #0B2545;
    border-bottom: 3px solid #31849B;
    padding: 46px 26px;
    background: #F8FAFC;
    margin-top: 12mm;
    margin-bottom: 10px;
    page-break-after: always;
    break-after: page;
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
    margin: 16px 0 10px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .sub-title {
    font-size: 10.5pt;
    font-weight: 700;
    color: #0B2545;
    margin: 12px 0 4px;
    page-break-after: avoid;
  }
  .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9pt; }
  .doc-table th, .doc-table td { border: 1px solid #CBD5E1; padding: 5.5px 7.5px; vertical-align: top; }
  .doc-table th { background: #0B2545; color: #FFFFFF; font-weight: 700; text-align: left; }
  .doc-table tr { page-break-inside: avoid; break-inside: avoid; }
  .kv-key { width: 32%; background: #F0F6FA; font-weight: 700; color: #0B2545; }
  .total-row td { background: #F8FAFC; font-weight: 800; color: #0B2545; }
  .num { text-align: right; font-family: Consolas, monospace; }
  .center { text-align: center; }
  p { margin: 0 0 6px; white-space: pre-line; }
</style>
</head>
<body>
  <div class="print-left-margin">
    <img src="${escapeHtml(leftMarginImg)}" alt="" />
  </div>
  <div class="print-header">
    <img src="${escapeHtml(headerBandImg)}" alt="" />
  </div>
  <div class="print-footer">
    <div class="print-footer-left">
      <img src="${escapeHtml(footerLogoImg)}" alt="" />
      <span>Creative Team Project &nbsp;|&nbsp; Brief&rsquo;s</span>
    </div>
    <span>${escapeHtml(data.eventName)}</span>
  </div>

  <table class="print-shell">
    <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
    <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
    <tbody>
      <tr>
        <td class="print-body">
          <div class="cover">
            <div class="cover-tag">EVENT PROJECT BRIEF &bull; EVENT PLANNING &amp; EXECUTION</div>
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
          <table class="doc-table">
            ${resolveOverviewSections(data)
              .map(
                (grp) =>
                  `<tr><td class="kv-key">${escapeHtml(grp.title)}</td><td style="white-space:pre-line;">${escapeHtml(
                    formatDocumentGroupItems(grp.items)
                  )}</td></tr>`
              )
              .join("")}
          </table>

          <div class="sec-title">02. EVENT EXPERIENCE &amp; PARTICIPANT JOURNEY</div>
          <table class="doc-table"><tr><td class="kv-key">Desired Atmosphere</td><td style="white-space:pre-line;">${escapeHtml(
            formatDocumentGroupItems(resolveAtmosphereItems(data))
          )}</td></tr></table>
          <table class="doc-table">
            <thead><tr><th style="width:55px;" class="center">Tahap</th><th style="width:140px;">Fase</th><th>Pengalaman Peserta (Participant Journey)</th></tr></thead>
            <tbody>
              ${resolveJourneySections(data)
                .map(
                  (grp, idx) =>
                    `<tr><td class="center">${idx + 1}</td><td><strong>${escapeHtml(
                      grp.title
                    )}</strong></td><td style="white-space:pre-line;">${escapeHtml(
                      formatDocumentGroupItems(grp.items)
                    )}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>

          <div class="sec-title">03A. SECTION &mdash; ACARA</div>
          <table class="doc-table">
            ${resolveAcaraSections(data)
              .map(
                (grp) =>
                  `<tr><td class="kv-key">${escapeHtml(grp.title)}</td><td style="white-space:pre-line;">${escapeHtml(
                    formatDocumentGroupItems(grp.items)
                  )}</td></tr>`
              )
              .join("")}
          </table>

          <div class="sec-title">03B. SECTION &mdash; DEKORASI</div>
          <table class="doc-table">
            ${resolveDecorSections(data)
              .map(
                (grp) =>
                  `<tr><td class="kv-key">${escapeHtml(grp.title)}</td><td style="white-space:pre-line;">${escapeHtml(
                    formatDocumentGroupItems(grp.items)
                  )}</td></tr>`
              )
              .join("")}
          </table>
          <div class="sub-title">Visualisasi Dekorasi</div>
          <table class="doc-table"><tr><td>${safeDecorImg ? `Mockup: ${escapeHtml(safeDecorImg)}` : "[Gambar Referensi / Mockup Dekorasi Panggung]"}</td></tr></table>
          <div class="sub-title">Daftar Kebutuhan Item Dekorasi</div>
          <table class="doc-table">
            <thead><tr><th style="width:42px;" class="center">No.</th><th style="width:200px;">Item Dekorasi</th><th style="width:70px;" class="center">Qty</th><th>Keterangan / Fungsi</th></tr></thead>
            <tbody>
              ${data.decorItems.map((d, idx) => `<tr><td class="center">${idx + 1}</td><td>${escapeHtml(d.name)}</td><td class="center">${escapeHtml(d.qty)}</td><td>${escapeHtml(d.description)}</td></tr>`).join("")}
            </tbody>
          </table>

          <div class="sec-title">03C. SECTION &mdash; PERLENGKAPAN &amp; TEKNIS</div>
          <table class="doc-table">
            <thead><tr><th style="width:42px;" class="center">No.</th><th style="width:180px;">Equipment / Peralatan</th><th style="width:70px;" class="center">Qty</th><th>Purpose / Kegunaan</th><th style="width:85px;" class="center">Priority</th></tr></thead>
            <tbody>
              ${data.equipmentItems.map((e, idx) => `<tr><td class="center">${idx + 1}</td><td>${escapeHtml(e.name)}</td><td class="center">${escapeHtml(e.qty)}</td><td>${escapeHtml(e.purpose)}</td><td class="center">${escapeHtml(e.priority)}</td></tr>`).join("")}
            </tbody>
          </table>
          <table class="doc-table"><tr><td style="white-space:pre-line;"><strong>Special Technical Requirements</strong><br/>${escapeHtml(
            formatDocumentGroupItems(resolveTechRequirementItems(data))
          )}</td></tr></table>

          <div class="sec-title">03D. SECTION &mdash; DOKUMENTASI</div>
          <table class="doc-table">
            ${resolvePddSections(data)
              .map(
                (grp) =>
                  `<tr><td class="kv-key">${escapeHtml(grp.title)}</td><td style="white-space:pre-line;">${escapeHtml(
                    formatDocumentGroupItems(grp.items)
                  )}</td></tr>`
              )
              .join("")}
          </table>

          <div class="sec-title">04. BUDGET OVERVIEW</div>
          <table class="doc-table">
            <thead><tr><th>Kategori</th><th class="num">Estimasi Anggaran</th><th class="num">Realisasi (Actual)</th><th class="center">Status</th></tr></thead>
            <tbody>
              ${data.budgetOverview.map((b) => `<tr><td>${escapeHtml(b.category)}</td><td class="num">${formatRupiah(b.estimated)}</td><td class="num">${b.actual > 0 ? formatRupiah(b.actual) : "&mdash;"}</td><td class="center">${escapeHtml(b.status)}</td></tr>`).join("")}
              <tr class="total-row"><td>TOTAL ESTIMASI</td><td class="num">${formatRupiah(totalEst)}</td><td class="num">${totalAct > 0 ? formatRupiah(totalAct) : "&mdash;"}</td><td class="center">Synced</td></tr>
            </tbody>
          </table>

          ${data.budgetDetails.length > 0 ? `
          <div class="sub-title">Estimasi Keperluan Budget Rinci</div>
          <table class="doc-table">
            <thead><tr><th>Keperluan</th><th class="center">Tgl Diperlukan</th><th class="center">Qty</th><th class="center">UOM</th><th class="num">Harga Satuan</th><th class="num">Total</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${data.budgetDetails.map((d) => `<tr><td style="white-space:pre-line;">${escapeHtml(d.itemName)}</td><td class="center">${escapeHtml(d.requiredDate)}</td><td class="center">${d.qty}</td><td class="center">${escapeHtml(d.uom)}</td><td class="num">${formatRupiah(d.unitPrice)}</td><td class="num"><strong>${formatRupiah(d.estimatedAmount)}</strong></td><td>${escapeHtml(d.notes)}</td></tr>`).join("")}
              <tr class="total-row"><td colspan="5" class="center">Total Rincian</td><td class="num">${formatRupiah(totalDetail)}</td><td></td></tr>
            </tbody>
          </table>` : ""}

          <div class="sec-title">05. KEY PEOPLE &amp; PIC (STRUKTUR PANITIA)</div>
          <table class="doc-table"><tr><td>${safeOrgUrl ? `Bagan Organisasi: ${escapeHtml(safeOrgUrl)}` : "[Struktur Organisasi Panitia Event]"}</td></tr></table>
          <table class="doc-table">
            <thead><tr><th style="width:32%;">Jabatan / Seksi</th><th style="width:34%;">Penanggung Jawab (PIC)</th><th>Kontak / Catatan</th></tr></thead>
            <tbody>
              ${(data.committee.length > 0 ? data.committee : [{ role: "-", pic: "Belum diisi di menu Sekretariat", contact: "-" }]).map((c) => `<tr><td><strong>${escapeHtml(c.role)}</strong></td><td>${escapeHtml(c.pic)}</td><td>${escapeHtml(c.contact)}</td></tr>`).join("")}
            </tbody>
          </table>

          <div class="sec-title">06. DAFTAR PELAYAN ACARA</div>
          <table class="doc-table">
            <thead><tr><th style="width:30%;">Posisi / Tim</th><th style="width:42%;">Nama Pelayan</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${(data.ministers.length > 0 ? data.ministers : [{ role: "-", members: "Belum diisi di menu Sekretariat", notes: "-" }]).map((m) => `<tr><td><strong>${escapeHtml(m.role)}</strong></td><td>${escapeHtml(m.members)}</td><td>${escapeHtml(m.notes)}</td></tr>`).join("")}
            </tbody>
          </table>

          <div class="sec-title">07. SUSUNAN ACARA (RUNDOWN)</div>
          <table class="doc-table">
            <thead><tr><th>Total Durasi Acara</th><th>Jam Open Gate</th><th>Jam Mulai</th><th>Jam Selesai</th></tr></thead>
            <tbody><tr><td>${escapeHtml(data.rundownTotalDuration)}</td><td>${escapeHtml(data.rundownOpenGate)}</td><td>${escapeHtml(data.rundownStartTime)}</td><td>${escapeHtml(data.rundownEndTime)}</td></tr></tbody>
          </table>
          <table class="doc-table">
            <thead><tr><th style="width:95px;">Waktu</th><th style="width:75px;">Durasi</th><th>Kegiatan</th><th style="width:120px;">PIC</th><th>Keterangan / Catatan Teknis</th></tr></thead>
            <tbody>
              ${(data.rundown.length > 0 ? data.rundown : [{ time: "-", duration: "-", activity: "Belum ada segmen rundown", pic: "-", notes: "-" }]).map((r) => `<tr><td>${escapeHtml(r.time)}</td><td>${escapeHtml(r.duration)}</td><td><strong>${escapeHtml(r.activity)}</strong></td><td>${escapeHtml(r.pic)}</td><td>${escapeHtml(r.notes)}</td></tr>`).join("")}
            </tbody>
          </table>

          <div class="sec-title">08. TEKNIS PELAKSANAAN</div>
          ${resolveTechnicalSections(data)
            .map(
              (grp) => `
                <div class="sub-title">${escapeHtml(grp.title)}</div>
                ${
                  grp.items.filter((line) => line.trim().length > 0).length > 0
                    ? grp.items
                        .filter((line) => line.trim().length > 0)
                        .map((line) => `<p>${escapeHtml(line)}</p>`)
                        .join("")
                    : "<p>-</p>"
                }
              `
            )
            .join("")}

          <div class="sec-title">09. APPROVAL &amp; FINAL CREATIVE DIRECTION</div>
          <table class="doc-table">
            <thead><tr><th>Role</th><th>Name</th><th style="width:110px;">Sign</th><th style="width:90px;">Date</th></tr></thead>
            <tbody>
              ${data.approvals.map((a) => `<tr><td><strong>${escapeHtml(a.role)}</strong></td><td>${escapeHtml(a.name)}</td><td style="height:34px;"></td><td>${escapeHtml(a.date)}</td></tr>`).join("")}
            </tbody>
          </table>
          <table class="doc-table"><tr><td style="white-space:pre-line;"><strong>Final Creative Direction</strong><br/>${escapeHtml(
            formatDocumentGroupItems(resolveFinalDirectionItems(data))
          )}</td></tr></table>
        </td>
      </tr>
    </tbody>
  </table>

  <script>
    window.addEventListener("load", function() {
      var imgs = Array.prototype.slice.call(document.images || []);
      Promise.all(imgs.map(function(img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve) {
          img.addEventListener("load", resolve);
          img.addEventListener("error", resolve);
        });
      })).then(function() {
        setTimeout(function() { window.print(); }, 200);
      });
    });
  </script>
</body>
</html>`;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
