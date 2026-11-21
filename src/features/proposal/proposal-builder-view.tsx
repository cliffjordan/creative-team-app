"use client";

import React, { useEffect, useState } from "react";
import { Event, EventBudgetLedgerItem, RundownItem } from "@/types/domain";
import { INITIAL_EVENT } from "@/lib/mock-db";
import {
  ProposalData,
  exportProposalToWord,
} from "@/lib/proposal/export-proposal-word";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  BookOpen,
  Download,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface ProposalBuilderViewProps {
  activeEvent?: Event;
  items?: RundownItem[];
}

const DEFAULT_PROPOSAL: ProposalData = {
  title: "Proposal Perayaan Natal PELNAP Sekolah Minggu 2026",
  concept: "God’s Got Talent",
  eventName: "The Greatest Talent",
  eventDate: "20 Desember 2026",
  eventTime: "16.00 – 18.30 WIB",
  location: "Gedung Utama Gereja",
  themeVerse: "“Berusahalah mengenal apa yang menyenangkan hati Tuhan” (Efesus 5:10, BIMK)",
  background:
    "Natal merupakan perayaan kelahiran Yesus Kristus, Sang Juru Selamat, yang membawa kasih dan keselamatan bagi semua orang. Melalui perayaan Natal PELNAP 2026 dengan tema “God’s Got Talent”, anak-anak Sekolah Minggu diajak untuk menyadari bahwa setiap pribadi telah menerima talenta dan kemampuan yang berbeda-beda sebagai anugerah Tuhan.",
  objectives: [
    "Menanamkan pemahaman kepada anak-anak bahwa setiap pribadi memiliki talenta dan kemampuan yang merupakan anugerah Tuhan.",
    "Mendorong anak-anak untuk mengenali, mengembangkan, dan menggunakan talenta yang dimiliki dengan sikap percaya diri serta bertanggung jawab.",
    "Memberikan ruang bagi anak-anak untuk mengekspresikan kreativitas melalui penampilan yang positif, membangun, dan sesuai dengan nilai-nilai Kristiani.",
    "Mengajarkan anak-anak bahwa talenta yang dimiliki dapat digunakan untuk melayani Tuhan, membangun sesama, dan menjadi berkat bagi orang lain.",
  ],
  detailAtmosphere:
    "Dekorasi utama menggunakan kain sebagai backdrop dengan penataan yang menarik. Area panggung menjadi fokus utama dengan dukungan lampu dekoratif untuk membangun suasana perayaan Natal yang meriah namun tetap khidmat.",
  detailDressCode:
    "Dress code mengusung konsep “Theme Costume”, di mana setiap kelas diberikan kebebasan untuk memilih dan mengembangkan salah satu tema yang telah ditentukan.",
  detailOpeningEvent:
    "Pembukaan acara akan diawali oleh Team Tambourine dengan membawakan lagu “Awesome God” sesuai arahan PIC Acara.",
  detailOpeningPerformance:
    "Setelah sesi Praise & Worship, pembukaan rangkaian Talent Show akan dipimpin oleh Team Musik dengan membawakan lagu “Praise”.",
  detailMainShow:
    "Setiap kelas akan menampilkan talenta terbaik mereka. Pada akhir rangkaian penampilan, akan diberikan Golden Ticket kepada kelas terpilih untuk tampil dalam Ibadah Natal Umum.",
  detailSermon:
    "Firman Tuhan disampaikan melalui video renungan singkat yang selaras dengan ayat tema Efesus 5:10.",
  committeeTitle: "Susunan Kepanitiaan PELNAP (Natal 2026 & Paskah 2027)",
  committee: [
    { role: "Koordinator Natal & Paskah", names: "Kak Febri" },
    { role: "Wakil Koordinator", names: "Kak Yasser" },
    { role: "Bendahara", names: "Kak Titin & Kak Yeni" },
    { role: "Sekretaris", names: "Kak Tyas" },
    { role: "Seksi Acara", names: "Kak Amanda" },
    { role: "Seksi Dekorasi", names: "Kak Amanda" },
    { role: "Seksi Perlengkapan, Dokumentasi & Soundsystem", names: "Kak Ofan & Kak Jordan" },
    { role: "Seksi Musik", names: "Kak Henricson" },
    { role: "Seksi Konsumsi", names: "Kak Inggrid & Kak Yani" },
    { role: "Seksi Dana", names: "Kak Asan & Kak Lulu" },
    { role: "Seksi Doa", names: "Kak Martha & Kak Rini" },
  ],
  decorImageUrl: "",
  decorItems: [
    { name: "Kain backdrop putih", description: "Sebagai background utama area tengah panggung" },
    { name: "Kain putih sheer / voal / tile", description: "Dibentuk drapery diagonal menyerupai pola X" },
    { name: "Lampu Tumblr", description: "Dipasang mengikuti alur kain untuk efek cahaya hangat" },
    { name: "LED Par", description: "Pencahayaan backdrop dan area panggung" },
    { name: "Extension cable & Power strip", description: "Distribusi dan pembagian sumber listrik" },
    { name: "Cable ties & Kawat Baja", description: "Penyangga, pengikat, dan perapihan kain backdrop" },
  ],
  budgets: [
    { item: "Backdrop, Kain dll (Dekorasi)", qty: "1 Set", amount: 2500000 },
    { item: "Lighting", qty: "1 Set", amount: 3000000 },
    { item: "Lain-lain", qty: "1 Paket", amount: 2000000 },
  ],
  ministers: [
    { role: "Song Leader / WL", members: "Kak Lulu, Kak Martha, Kak Asan" },
    { role: "Singer", members: "Kak Yosi, Kak Yehezkiel, Kak Cheo, Kak Wahyu, Kak Lady" },
    { role: "Team Musik", members: "Keyboard 1 (Dyta), Keyboard 2 (Davin), Gitar (Bill), Bass (Jojo), Drum (Dylan)" },
    { role: "LCD & Soundsystem", members: "LCD: Kak Gizelle / Kak Billy | Sound: Kak Johan Irawan" },
    { role: "Usher & Kolektan", members: "Usher: Kakak Wali Kelas | Kolektan: Teens" },
    { role: "MC", members: "Kak Febe & Kak Luna" },
  ],
  rundownTotalDuration: "150 Menit (2 Jam 30 Menit)",
  rundownStartTime: "16.00 WIB",
  rundownEndTime: "18.30 WIB",
  rundown: [
    { time: "15.30 – 16.00", duration: "30m", activity: "Open Gate", pic: "Usher Wali Kelas", notes: "Absensi anak & pembagian lilin elektrik" },
    { time: "16.00 – 16.10", duration: "10m", activity: "Countdown + Opening", pic: "Team Tambourine", notes: "Countdown oleh team mulmed" },
    { time: "16.10 – 16.35", duration: "25m", activity: "Praise & Worship", pic: "Team P&W", notes: "Doa Pembuka, Praise (2 Lagu), Worship (2 Lagu), Persembahan" },
    { time: "16.35 – 16.45", duration: "10m", activity: "Penyampaian Renungan Natal", pic: "Multimedia / WL", notes: "Video renungan singkat" },
    { time: "16.45 – 17.00", duration: "15m", activity: "Candle Light Service", pic: "Kak Asan & MC", notes: "Diiringi lagu O Holy Night" },
  ],
  techEvent:
    "Usher menyambut setiap anak, mengisi kehadiran, memberikan lilin elektrik, dan mengantarkan ke area tempat duduk sesuai kelas masing-masing.",
  techSpecialSession:
    "Kak Asan memanggil setiap nama yang sudah ditentukan mulai dari Bapak Gembala sampai para wali kelas. Diiringi lagu O Holy Night.",
  techPerformance:
    "Sebelum penampilan kelas pertama dimulai, MC menyapa anak-anak dan memberikan penjelasan singkat rangkaian acara serta arahan dokumentasi bagi orang tua.",
  approverLeader: "Koordinator Panitia",
  approverSecretary: "Sekretaris",
  approverTreasurer: "Bendahara",
  approverPastor: "Gembala Sidang",
};

type ProposalStep = "UMUM" | "KONSEP" | "PANITIA_DEKOR" | "ANGGARAN_PELAYAN" | "RUNDOWN_TEKNIS";

export function ProposalBuilderView({
  activeEvent = INITIAL_EVENT,
  items = [],
}: ProposalBuilderViewProps) {
  const storageKey = `CT_EVENT_PROPOSAL_${activeEvent.id}`;
  const [step, setStep] = useState<ProposalStep>("UMUM");
  const [data, setData] = useState<ProposalData>(DEFAULT_PROPOSAL);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setData(JSON.parse(saved) as ProposalData);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {}
  }, [data, storageKey]);

  const handleSyncFromEvent = () => {
    let syncedBudgets = data.budgets;
    try {
      const rawBudgets = localStorage.getItem("CT_SECTION_BUDGETS");
      if (rawBudgets) {
        const parsed = JSON.parse(rawBudgets) as EventBudgetLedgerItem[];
        if (Array.isArray(parsed)) {
          const eventBudgets = parsed.filter(
            (b) => (b.event_id || INITIAL_EVENT.id) === activeEvent.id
          );
          if (eventBudgets.length > 0) {
            syncedBudgets = eventBudgets.map((b) => ({
              item: `${b.item_name} (${b.section})`,
              qty: "1 Paket",
              amount: b.estimated_amount || b.actual_amount || 0,
            }));
          }
        }
      }
    } catch {}

    const syncedRundown =
      items.length > 0
        ? items.map((it, idx) => ({
            time: `Segmen #${idx + 1}`,
            duration: `${it.estimated_duration_minutes}m`,
            activity: it.title,
            pic: it.section_pic,
            notes: it.technical_notes || "-",
          }))
        : data.rundown;

    const totalMins = items.reduce((acc, it) => acc + (it.estimated_duration_minutes || 0), 0);

    setData((prev) => ({
      ...prev,
      title: `Proposal ${activeEvent.title}`,
      eventName: activeEvent.title,
      concept: activeEvent.theme || prev.concept,
      eventDate: new Date(activeEvent.event_date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      budgets: syncedBudgets,
      rundown: syncedRundown,
      rundownTotalDuration: totalMins > 0 ? `${totalMins} Menit` : prev.rundownTotalDuration,
    }));
    setSyncNotice("Data Event, Rundown, dan Anggaran berhasil disinkronkan ke template proposal.");
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const totalBudget = data.budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Template &amp; Generator Proposal Event</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Isi atau sinkronkan data acara, lalu unduh langsung sebagai dokumen Microsoft Word (.doc).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncFromEvent}
            className="text-xs font-bold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tarik Data Event &amp; Rundown</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => exportProposalToWord(data)}
            className="text-xs font-bold gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Word (.doc)</span>
          </Button>
        </div>
      </div>

      {syncNotice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800">
          {syncNotice}
        </div>
      )}

      {/* Step Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: "UMUM", label: "1. Identitas & Latar Belakang" },
            { id: "KONSEP", label: "2. Konsep Detail" },
            { id: "PANITIA_DEKOR", label: "3. Panitia & Dekorasi" },
            { id: "ANGGARAN_PELAYAN", label: "4. Anggaran & Pelayan" },
            { id: "RUNDOWN_TEKNIS", label: "5. Rundown & Pengesahan" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStep(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
              step === tab.id
                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div key={step} className="animate-tab-enter">
      {/* Step 1: Identitas & Latar Belakang */}
      {step === "UMUM" && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Judul Proposal</label>
              <input
                type="text"
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Konsep / Tema Besar</label>
              <input
                type="text"
                value={data.concept}
                onChange={(e) => setData({ ...data, concept: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nama Acara</label>
              <input
                type="text"
                value={data.eventName}
                onChange={(e) => setData({ ...data, eventName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Pelaksanaan</label>
              <input
                type="text"
                value={data.eventDate}
                onChange={(e) => setData({ ...data, eventDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Waktu</label>
              <input
                type="text"
                value={data.eventTime}
                onChange={(e) => setData({ ...data, eventTime: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tempat / Lokasi</label>
              <input
                type="text"
                value={data.location}
                onChange={(e) => setData({ ...data, location: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Ayat Tema</label>
            <input
              type="text"
              value={data.themeVerse}
              onChange={(e) => setData({ ...data, themeVerse: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">1. Latar Belakang</label>
            <textarea
              rows={4}
              value={data.background}
              onChange={(e) => setData({ ...data, background: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">2. Tujuan Acara</label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setData({ ...data, objectives: [...data.objectives, ""] })}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Poin
              </Button>
            </div>
            {data.objectives.map((obj, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                <input
                  type="text"
                  value={obj}
                  onChange={(e) => {
                    const next = [...data.objectives];
                    next[idx] = e.target.value;
                    setData({ ...data, objectives: next });
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setData({
                      ...data,
                      objectives: data.objectives.filter((_, i) => i !== idx),
                    })
                  }
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Step 2: Konsep Detail */}
      {step === "KONSEP" && (
        <Card className="p-5 space-y-3">
          {(
            [
              { key: "detailAtmosphere", label: "Suasana & Dekorasi" },
              { key: "detailDressCode", label: "Pakaian (Dress Code)" },
              { key: "detailOpeningEvent", label: "Opening Acara" },
              { key: "detailOpeningPerformance", label: "Opening Penampilan" },
              { key: "detailMainShow", label: "Inti Acara / Talent Show Off" },
              { key: "detailSermon", label: "Penyampaian Firman" },
            ] as const
          ).map((field) => (
            <div key={field.key}>
              <label className="text-xs font-bold text-slate-700 block mb-1">{field.label}</label>
              <textarea
                rows={2}
                value={data[field.key]}
                onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
          ))}
        </Card>
      )}

      {/* Step 3: Panitia & Dekorasi */}
      {step === "PANITIA_DEKOR" && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">4. Susunan Kepanitiaan</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    committee: [...data.committee, { role: "Seksi Baru", names: "" }],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Seksi
              </Button>
            </div>
            <div className="space-y-2.5">
              {data.committee.map((c, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-0 sm:bg-transparent sm:border-0"
                >
                  <div className="sm:col-span-5">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Jabatan / Seksi
                    </span>
                    <input
                      type="text"
                      value={c.role}
                      onChange={(e) => {
                        const next = [...data.committee];
                        next[idx] = { ...next[idx], role: e.target.value };
                        setData({ ...data, committee: next });
                      }}
                      placeholder="Jabatan / Seksi"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Koordinator / Anggota
                    </span>
                    <input
                      type="text"
                      value={c.names}
                      onChange={(e) => {
                        const next = [...data.committee];
                        next[idx] = { ...next[idx], names: e.target.value };
                        setData({ ...data, committee: next });
                      }}
                      placeholder="Nama Koordinator / Anggota"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        committee: data.committee.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">5. Kebutuhan Dekorasi</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    decorItems: [...data.decorItems, { name: "", description: "" }],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Item
              </Button>
            </div>
            <input
              type="url"
              value={data.decorImageUrl}
              onChange={(e) => setData({ ...data, decorImageUrl: e.target.value })}
              placeholder="URL Referensi Gambar Visualisasi Dekorasi (opsional)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <div className="space-y-2.5">
              {data.decorItems.map((d, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-0 sm:bg-transparent sm:border-0"
                >
                  <div className="sm:col-span-5">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Item Dekorasi
                    </span>
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => {
                        const next = [...data.decorItems];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setData({ ...data, decorItems: next });
                      }}
                      placeholder="Item Dekorasi"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Keterangan / Fungsi
                    </span>
                    <input
                      type="text"
                      value={d.description}
                      onChange={(e) => {
                        const next = [...data.decorItems];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setData({ ...data, decorItems: next });
                      }}
                      placeholder="Keterangan / Fungsi"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        decorItems: data.decorItems.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Step 4: Anggaran & Pelayan */}
      {step === "ANGGARAN_PELAYAN" && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">6. Estimasi Kebutuhan Anggaran</h3>
                <p className="text-xs text-slate-500">
                  Total Estimasi: <strong className="text-emerald-700 font-mono">{formatCurrencyIDR(totalBudget)}</strong>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    budgets: [...data.budgets, { item: "", qty: "1 Set", amount: 0 }],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Keperluan
              </Button>
            </div>
            <div className="space-y-2.5">
              {data.budgets.map((b, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-0 sm:bg-transparent sm:border-0"
                >
                  <div className="sm:col-span-5">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Keperluan
                    </span>
                    <input
                      type="text"
                      value={b.item}
                      onChange={(e) => {
                        const next = [...data.budgets];
                        next[idx] = { ...next[idx], item: e.target.value };
                        setData({ ...data, budgets: next });
                      }}
                      placeholder="Keperluan"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      QTY
                    </span>
                    <input
                      type="text"
                      value={b.qty}
                      onChange={(e) => {
                        const next = [...data.budgets];
                        next[idx] = { ...next[idx], qty: e.target.value };
                        setData({ ...data, budgets: next });
                      }}
                      placeholder="QTY"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Total Dana (Rp)
                    </span>
                    <input
                      type="number"
                      value={b.amount}
                      onChange={(e) => {
                        const next = [...data.budgets];
                        next[idx] = { ...next[idx], amount: Number(e.target.value) || 0 };
                        setData({ ...data, budgets: next });
                      }}
                      placeholder="Total Dana (Rp)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        budgets: data.budgets.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">7. Daftar Pelayan Acara</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    ministers: [...data.ministers, { role: "", members: "" }],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Bidang
              </Button>
            </div>
            <div className="space-y-2.5">
              {data.ministers.map((m, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-0 sm:bg-transparent sm:border-0"
                >
                  <div className="sm:col-span-4">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Bidang Pelayanan
                    </span>
                    <input
                      type="text"
                      value={m.role}
                      onChange={(e) => {
                        const next = [...data.ministers];
                        next[idx] = { ...next[idx], role: e.target.value };
                        setData({ ...data, ministers: next });
                      }}
                      placeholder="Bidang Pelayanan"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-7">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Nama Pelayan / Tim
                    </span>
                    <input
                      type="text"
                      value={m.members}
                      onChange={(e) => {
                        const next = [...data.ministers];
                        next[idx] = { ...next[idx], members: e.target.value };
                        setData({ ...data, ministers: next });
                      }}
                      placeholder="Nama Pelayan / Tim"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        ministers: data.ministers.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Step 5: Rundown & Pengesahan */}
      {step === "RUNDOWN_TEKNIS" && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">8. Susunan Acara (Rundown)</h3>
                <Badge variant="purple" className="text-[10px]">
                  {data.rundown.length} Segmen
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    rundown: [
                      ...data.rundown,
                      { time: "", duration: "10m", activity: "", pic: "", notes: "" },
                    ],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris
              </Button>
            </div>
            <div className="space-y-2.5">
              {data.rundown.map((r, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-0 sm:bg-transparent sm:border-0"
                >
                  <div className="sm:col-span-2">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Waktu
                    </span>
                    <input
                      type="text"
                      value={r.time}
                      onChange={(e) => {
                        const next = [...data.rundown];
                        next[idx] = { ...next[idx], time: e.target.value };
                        setData({ ...data, rundown: next });
                      }}
                      placeholder="Waktu"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Durasi
                    </span>
                    <input
                      type="text"
                      value={r.duration}
                      onChange={(e) => {
                        const next = [...data.rundown];
                        next[idx] = { ...next[idx], duration: e.target.value };
                        setData({ ...data, rundown: next });
                      }}
                      placeholder="Durasi"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Kegiatan
                    </span>
                    <input
                      type="text"
                      value={r.activity}
                      onChange={(e) => {
                        const next = [...data.rundown];
                        next[idx] = { ...next[idx], activity: e.target.value };
                        setData({ ...data, rundown: next });
                      }}
                      placeholder="Kegiatan"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      PIC
                    </span>
                    <input
                      type="text"
                      value={r.pic}
                      onChange={(e) => {
                        const next = [...data.rundown];
                        next[idx] = { ...next[idx], pic: e.target.value };
                        setData({ ...data, rundown: next });
                      }}
                      placeholder="PIC"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <span className="sm:hidden text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Keterangan
                    </span>
                    <input
                      type="text"
                      value={r.notes}
                      onChange={(e) => {
                        const next = [...data.rundown];
                        next[idx] = { ...next[idx], notes: e.target.value };
                        setData({ ...data, rundown: next });
                      }}
                      placeholder="Keterangan"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        rundown: data.rundown.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 text-slate-400 hover:text-rose-600 justify-self-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">8.1 – 8.3 Teknis Pelaksanaan &amp; Pengesahan</h3>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">8.1 Teknis Acara</label>
              <textarea
                rows={2}
                value={data.techEvent}
                onChange={(e) => setData({ ...data, techEvent: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">8.2 Teknis Sesi Khusus / Candle Light</label>
              <textarea
                rows={2}
                value={data.techSpecialSession}
                onChange={(e) => setData({ ...data, techSpecialSession: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">8.3 Teknis Penampilan &amp; Transisi MC</label>
              <textarea
                rows={2}
                value={data.techPerformance}
                onChange={(e) => setData({ ...data, techPerformance: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <input
                type="text"
                value={data.approverLeader}
                onChange={(e) => setData({ ...data, approverLeader: e.target.value })}
                placeholder="Ketua Panitia"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={data.approverSecretary}
                onChange={(e) => setData({ ...data, approverSecretary: e.target.value })}
                placeholder="Sekretaris"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={data.approverTreasurer}
                onChange={(e) => setData({ ...data, approverTreasurer: e.target.value })}
                placeholder="Bendahara"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={data.approverPastor}
                onChange={(e) => setData({ ...data, approverPastor: e.target.value })}
                placeholder="Gembala / Pembina"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
