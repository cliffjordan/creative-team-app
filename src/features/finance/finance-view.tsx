"use client";

import React, { useEffect, useMemo, useState } from "react";
import { INITIAL_EVENT, getFinanceAccessMode, isCreativeLeader } from "@/lib/mock-db";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { Event, EventBudgetLedgerItem, SectionType, User } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrencyIDR, getTodayIsoWIB, sanitizeHttpUrl } from "@/lib/utils";
import {
  Calendar,
  DollarSign,
  Edit2,
  ExternalLink,
  Eye,
  Lock,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";

const STORAGE_KEY = "CT_SECTION_BUDGETS";

const UOM_OPTIONS = ["Set", "Pack", "Kaleng", "Lembar", "Meter", "Pcs", "Paket", "Box", "Unit", "Orang"];

const BUDGET_CATEGORIES = [
  "Acara",
  "Dekorasi",
  "Perlengkapan",
  "Dokumentasi",
  "Kado / Apresiasi",
  "Konsumsi",
  "Multimedia",
  "Lain-lain / Contingency",
];

const SECTION_DISPLAY_ORDER: SectionType[] = ["DEKORASI", "ACARA", "PERLENGKAPAN", "PDD", "INTI", "ALL"];

const SECTION_TITLE_MAP: Record<SectionType, string> = {
  DEKORASI: "Sie. Dekorasi",
  ACARA: "Sie. Acara",
  PERLENGKAPAN: "Sie. Perlengkapan",
  PDD: "Sie. Dokumentasi & Multimedia",
  INTI: "Pengeluaran Inti / Umum",
  ALL: "Lain-lain",
};

interface FinanceViewProps {
  currentUser: User | null;
  activeEvent?: Event;
}

function formatIndonesianDate(isoDate?: string | null): string {
  if (!isoDate) return "-";
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatRpNumeric(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function FinanceView({ currentUser, activeEvent = INITIAL_EVENT }: FinanceViewProps) {
  const accessMode = getFinanceAccessMode(currentUser);
  const canEdit = accessMode === "EDIT" || isCreativeLeader(currentUser);

  const [budgets, setBudgets] = useState<EventBudgetLedgerItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as EventBudgetLedgerItem[];
      }
    } catch {}
    return [];
  });

  const [sectionFilter, setSectionFilter] = useState<"ALL" | SectionType>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventBudgetLedgerItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal Form State (sesuai Gambar 1 + Tabel 04 template .docx)
  const [itemSection, setItemSection] = useState<SectionType>("DEKORASI");
  const [budgetCategory, setBudgetCategory] = useState("Dekorasi");
  const [itemName, setItemName] = useState("");
  const [requiredDate, setRequiredDate] = useState(() => activeEvent.event_date || getTodayIsoWIB());
  const [quantity, setQuantity] = useState("1");
  const [uom, setUom] = useState("Set");
  const [unitPrice, setUnitPrice] = useState("");
  const [actAmount, setActAmount] = useState("");
  const [budgetStatus, setBudgetStatus] = useState("Planning");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!activeEvent.id) return;
    let mounted = true;
    fetch(`/api/events/${activeEvent.id}/budget`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.success || !Array.isArray(data.items)) return;
        const remoteItems = data.items as EventBudgetLedgerItem[];
        setBudgets((prev) => {
          const otherEvents = prev.filter((b) => b.event_id !== activeEvent.id);
          const merged = [...otherEvents, ...remoteItems];
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            publishSyncMessage(STORAGE_KEY, merged);
          } catch {}
          return merged;
        });
      })
      .catch(() => {});

    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === STORAGE_KEY && Array.isArray(msg.payload)) {
        setBudgets(msg.payload as EventBudgetLedgerItem[]);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeEvent.id]);

  const persistLocalBudgets = (next: EventBudgetLedgerItem[]) => {
    setBudgets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      publishSyncMessage(STORAGE_KEY, next);
    } catch {}
  };

  const filteredBudgets = useMemo(
    () =>
      budgets.filter(
        (b) =>
          b.event_id === activeEvent.id &&
          (sectionFilter === "ALL" || b.section === sectionFilter)
      ),
    [budgets, activeEvent.id, sectionFilter]
  );

  const groupedBySection = useMemo(() => {
    const groups: { section: SectionType; label: string; items: EventBudgetLedgerItem[] }[] = [];
    for (const sec of SECTION_DISPLAY_ORDER) {
      const secItems = filteredBudgets.filter((b) => b.section === sec);
      if (secItems.length > 0) {
        groups.push({ section: sec, label: SECTION_TITLE_MAP[sec], items: secItems });
      }
    }
    return groups;
  }, [filteredBudgets]);

  const totalEstimated = useMemo(
    () => filteredBudgets.reduce((acc, b) => acc + (Number(b.estimated_amount) || 0), 0),
    [filteredBudgets]
  );

  const totalActual = useMemo(
    () => filteredBudgets.reduce((acc, b) => acc + (Number(b.actual_amount) || 0), 0),
    [filteredBudgets]
  );

  const computedLineTotal = useMemo(() => {
    const q = Number(quantity) || 0;
    const p = Number(unitPrice) || 0;
    return Math.max(0, q * p);
  }, [quantity, unitPrice]);

  const variance = totalEstimated - totalActual;

  const openAddModal = () => {
    setEditingItem(null);
    setItemSection("DEKORASI");
    setBudgetCategory("Dekorasi");
    setItemName("");
    setRequiredDate(activeEvent.event_date || getTodayIsoWIB());
    setQuantity("1");
    setUom("Set");
    setUnitPrice("");
    setActAmount("0");
    setBudgetStatus("Planning");
    setReceiptUrl("");
    setNotes("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: EventBudgetLedgerItem) => {
    setEditingItem(item);
    setItemSection(item.section);
    setBudgetCategory(item.budget_category || SECTION_TITLE_MAP[item.section] || "Dekorasi");
    setItemName(item.item_name);
    setRequiredDate(item.required_date || "");
    setQuantity(String(item.quantity ?? 1));
    setUom(item.uom || "Set");
    setUnitPrice(String(item.unit_price ?? item.estimated_amount ?? 0));
    setActAmount(String(item.actual_amount ?? 0));
    setBudgetStatus(item.budget_status || "Planning");
    setReceiptUrl(item.receipt_photo_url ?? "");
    setNotes(item.notes ?? "");
    setIsModalOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!canEdit || !itemName.trim() || !activeEvent.id) return;
    setSaving(true);
    const safeReceiptUrl = sanitizeHttpUrl(receiptUrl);
    const qtyNum = Number(quantity) || 1;
    const unitPriceNum = Number(unitPrice) || 0;
    const estTotal = Math.max(0, qtyNum * unitPriceNum);

    const payload = {
      section: itemSection,
      budget_category: budgetCategory,
      item_name: itemName.trim(),
      required_date: requiredDate || null,
      quantity: qtyNum,
      uom: uom.trim() || "Set",
      unit_price: unitPriceNum,
      estimated_amount: estTotal,
      actual_amount: Number(actAmount) || 0,
      budget_status: budgetStatus,
      receipt_photo_url: safeReceiptUrl,
      notes: notes.trim() || null,
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/events/${activeEvent.id}/budget`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
        const data = await res.json();
        const savedItem: EventBudgetLedgerItem = data?.item
          ? data.item
          : { ...editingItem, ...payload };
        persistLocalBudgets(budgets.map((b) => (b.id === editingItem.id ? savedItem : b)));
      } else {
        const res = await fetch(`/api/events/${activeEvent.id}/budget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const savedItem: EventBudgetLedgerItem = data?.item
          ? data.item
          : {
              id: `b-${Date.now()}`,
              event_id: activeEvent.id,
              ...payload,
              created_at: new Date().toISOString(),
            };
        persistLocalBudgets([...budgets, savedItem]);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!canEdit) return;
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/budget?itemId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    persistLocalBudgets(budgets.filter((b) => b.id !== id));
  };

  if (accessMode === "LOCKED") {
    return (
      <Card className="p-8 text-center space-y-2.5 border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900">Akses Pembiayaan Dibatasi</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Menu Pembiayaan &amp; Anggaran hanya dapat diakses oleh pimpinan, koordinator seksi, dan dikelola oleh Bendahara.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <span>Estimasi Keperluan Budget — {activeEvent.title}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tanggal Diperlukan otomatis tersinkron ke <strong>Kalender</strong> &amp; tabel rincian ditarik ke <strong>Dokumen Event</strong>.
          </p>
        </div>

        {canEdit && (
          <Button
            size="sm"
            variant="emerald"
            onClick={openAddModal}
            className="text-xs font-bold gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Item Budget</span>
          </Button>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-2.5 text-xs text-indigo-800">
          <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Mode Monitoring (Read-Only):</strong> Penambahan dan pengeditan anggaran hanya dilakukan oleh <strong>Bendahara</strong> / <strong>Creative Leader</strong>.
          </span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Estimasi Budget
          </div>
          <div className="text-lg font-extrabold font-mono text-slate-900 mt-1">
            {formatCurrencyIDR(totalEstimated)}
          </div>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Total Realisasi (Aktual)
          </div>
          <div className="text-lg font-extrabold font-mono text-emerald-700 mt-1">
            {formatCurrencyIDR(totalActual)}
          </div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Selisih Anggaran
          </div>
          <div
            className={`text-lg font-extrabold font-mono mt-1 ${
              variance >= 0 ? "text-indigo-600" : "text-rose-600"
            }`}
          >
            {variance >= 0 ? "+" : ""}
            {formatCurrencyIDR(variance)}
          </div>
        </Card>
      </div>

      {/* Section Filter */}
      <div data-lenis-prevent className="flex gap-1.5 overflow-x-auto pb-1">
        {(["ALL", "DEKORASI", "ACARA", "PERLENGKAPAN", "PDD", "INTI"] as const).map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => setSectionFilter(sec)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
              sectionFilter === sec
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
          >
            {sec === "ALL" ? "Semua Seksi" : SECTION_TITLE_MAP[sec]}
          </button>
        ))}
      </div>

      {/* Tabel Format Gambar 1 */}
      {filteredBudgets.length === 0 ? (
        <Card className="p-8 text-center text-xs text-slate-400">
          Belum ada catatan keperluan anggaran untuk filter ini.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-300 shadow-sm">
          <div data-lenis-prevent className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-900 min-w-[820px]">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <th rowSpan={2} className="border-r border-slate-300 px-3 py-2.5 text-center w-[24%]">
                    Keperluan
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-3 py-2.5 text-center w-[13%]">
                    Tanggal Diperlukan
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-2.5 py-2.5 text-center w-[6%]">
                    Qty
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-2.5 py-2.5 text-center w-[8%]">
                    UOM
                  </th>
                  <th colSpan={2} className="border-b border-r border-slate-300 px-3 py-1.5 text-center">
                    Harga
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-3 py-2.5 text-center w-[25%]">
                    Keterangan
                  </th>
                  {canEdit && (
                    <th rowSpan={2} className="px-2.5 py-2.5 text-center w-[8%]">
                      Aksi
                    </th>
                  )}
                </tr>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <th className="border-r border-slate-300 px-3 py-1.5 text-center w-[10%]">
                    Satuan
                  </th>
                  <th className="border-r border-slate-300 px-3 py-1.5 text-center w-[10%]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedBySection.map((group) => (
                  <React.Fragment key={group.section}>
                    {/* Sub-header Seksi (seperti 'Sie. Dekorasi' pada Gambar 1) */}
                    <tr className="bg-slate-50 border-b border-slate-300">
                      <td
                        colSpan={canEdit ? 8 : 7}
                        className="px-3 py-2 font-extrabold text-slate-900"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-300 bg-white hover:bg-slate-50/70 align-middle"
                      >
                        <td className="border-r border-slate-300 px-3 py-2.5 whitespace-pre-line font-medium text-slate-900">
                          <div>{item.item_name}</div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {item.budget_category && (
                              <Badge variant="neutral" className="text-[9px] py-0">
                                {item.budget_category}
                              </Badge>
                            )}
                            {item.actual_amount > 0 && (
                              <Badge variant="emerald" className="text-[9px] py-0">
                                Aktual: {formatCurrencyIDR(item.actual_amount)}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="border-r border-slate-300 px-2.5 py-2.5 text-center text-slate-700">
                          {item.required_date ? (
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                              {formatIndonesianDate(item.required_date)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="border-r border-slate-300 px-2 py-2.5 text-center font-mono">
                          {item.quantity ?? 1}
                        </td>
                        <td className="border-r border-slate-300 px-2 py-2.5 text-center">
                          {item.uom || "Set"}
                        </td>
                        <td className="border-r border-slate-300 px-3 py-2.5 font-mono">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Rp</span>
                            <span>{formatRpNumeric(item.unit_price ?? item.estimated_amount)}</span>
                          </div>
                        </td>
                        <td className="border-r border-slate-300 px-3 py-2.5 font-mono font-bold">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 font-normal">Rp</span>
                            <span>{formatRpNumeric(item.estimated_amount)}</span>
                          </div>
                        </td>
                        <td className="border-r border-slate-300 px-3 py-2.5 whitespace-pre-line text-slate-700">
                          <div>{item.notes || "-"}</div>
                          {sanitizeHttpUrl(item.receipt_photo_url) && (
                            <a
                              href={sanitizeHttpUrl(item.receipt_photo_url)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-indigo-600 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Nota</span>
                            </a>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-2 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title="Edit item"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBudget(item.id)}
                                title="Hapus item"
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-extrabold text-slate-900 border-t-2 border-slate-400">
                  <td colSpan={4} className="px-4 py-2.5 text-center border-r border-slate-300">
                    Total
                  </td>
                  <td className="border-r border-slate-300 px-3 py-2.5 text-left font-mono">
                    Rp
                  </td>
                  <td className="border-r border-slate-300 px-3 py-2.5 text-right font-mono">
                    {formatRpNumeric(totalEstimated)}
                  </td>
                  <td colSpan={canEdit ? 2 : 1} className="px-3 py-2.5 text-[11px] font-normal text-slate-500">
                    Total Estimasi Keseluruhan
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Tambah / Edit Biaya */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? "Edit Item Pembiayaan" : "Tambah Item Pembiayaan"}
        description="Isi keperluan, tanggal diperlukan, qty/UOM, dan harga satuan sesuai format laporan."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Seksi / Group</label>
              <select
                value={itemSection}
                onChange={(e) => setItemSection(e.target.value as SectionType)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
              >
                <option value="DEKORASI">Sie. Dekorasi</option>
                <option value="ACARA">Sie. Acara</option>
                <option value="PERLENGKAPAN">Sie. Perlengkapan</option>
                <option value="PDD">Sie. Dokumentasi &amp; Multimedia</option>
                <option value="INTI">Inti / Lain-lain</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Kategori Dokumen (04. Budget Overview)
              </label>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
              >
                {BUDGET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Keperluan (Mendukung Daftar Multi-Baris) *
            </label>
            <textarea
              rows={3}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={"Dekorasi Main Stage\n1. Backdrop Kain\n2. Lampu Tumblr"}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tanggal Diperlukan
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Qty</label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">UOM (Satuan)</label>
              <select
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Harga Satuan (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-indigo-700 block mb-1">
                Harga Total (Auto)
              </label>
              <div className="w-full p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs sm:text-sm text-indigo-900 font-mono font-bold">
                {formatCurrencyIDR(computedLineTotal)}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-emerald-700 block mb-1">
                Realisasi Aktual (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={actAmount}
                onChange={(e) => setActAmount(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 rounded-xl bg-emerald-50/30 border border-emerald-300 text-xs sm:text-sm text-slate-900 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Status Anggaran</label>
              <select
                value={budgetStatus}
                onChange={(e) => setBudgetStatus(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
              >
                <option value="Planning">Planning</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid / Lunas</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                URL Foto Nota (Opsional)
              </label>
              <input
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Keterangan / Syarat Pembayaran (Opsional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: DownPayment Minimal H-14 sebesar 50% dari total biaya"
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            >
              Batal
            </Button>
            <Button variant="emerald" size="sm" disabled={saving} onClick={handleSaveBudget}>
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              {saving ? "Menyimpan..." : editingItem ? "Simpan Perubahan" : "Simpan Item"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
