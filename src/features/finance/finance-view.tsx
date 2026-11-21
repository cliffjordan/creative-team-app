"use client";

import React, { useEffect, useMemo, useState } from "react";
import { INITIAL_EVENT, getFinanceAccessMode } from "@/lib/mock-db";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { Event, EventBudgetLedgerItem, SectionType, User } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrencyIDR, sanitizeHttpUrl } from "@/lib/utils";
import { DollarSign, Edit2, ExternalLink, Eye, Lock, Plus, Trash2, Wallet } from "lucide-react";

const STORAGE_KEY = "CT_SECTION_BUDGETS";

const INITIAL_BUDGETS: EventBudgetLedgerItem[] = [];

interface FinanceViewProps {
  currentUser: User | null;
  activeEvent?: Event;
}

export function FinanceView({ currentUser, activeEvent = INITIAL_EVENT }: FinanceViewProps) {
  const accessMode = getFinanceAccessMode(currentUser);
  const canEdit = accessMode === "EDIT";

  const [budgets, setBudgets] = useState<EventBudgetLedgerItem[]>(() => {
    if (typeof window === "undefined") return INITIAL_BUDGETS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as EventBudgetLedgerItem[];
      }
    } catch {}
    return INITIAL_BUDGETS;
  });

  const [sectionFilter, setSectionFilter] = useState<"ALL" | SectionType>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventBudgetLedgerItem | null>(null);

  const [itemSection, setItemSection] = useState<SectionType>("DEKORASI");
  const [itemName, setItemName] = useState("");
  const [estAmount, setEstAmount] = useState("");
  const [actAmount, setActAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeSyncMessages((msg) => {
      if (msg.key === STORAGE_KEY && Array.isArray(msg.payload)) {
        setBudgets(msg.payload as EventBudgetLedgerItem[]);
      }
    });
    return () => unsubscribe();
  }, []);

  const persistBudgets = (next: EventBudgetLedgerItem[]) => {
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
          (b.event_id || INITIAL_EVENT.id) === activeEvent.id &&
          (sectionFilter === "ALL" || b.section === sectionFilter)
      ),
    [budgets, activeEvent.id, sectionFilter]
  );

  const totalEstimated = useMemo(
    () => filteredBudgets.reduce((acc, b) => acc + (b.estimated_amount || 0), 0),
    [filteredBudgets]
  );

  const totalActual = useMemo(
    () => filteredBudgets.reduce((acc, b) => acc + (b.actual_amount || 0), 0),
    [filteredBudgets]
  );

  const variance = totalEstimated - totalActual;

  const openAddModal = () => {
    setEditingItem(null);
    setItemSection("DEKORASI");
    setItemName("");
    setEstAmount("");
    setActAmount("");
    setReceiptUrl("");
    setNotes("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: EventBudgetLedgerItem) => {
    setEditingItem(item);
    setItemSection(item.section);
    setItemName(item.item_name);
    setEstAmount(String(item.estimated_amount ?? 0));
    setActAmount(String(item.actual_amount ?? 0));
    setReceiptUrl(item.receipt_photo_url ?? "");
    setNotes(item.notes ?? "");
    setIsModalOpen(true);
  };

  const handleSaveBudget = () => {
    if (!canEdit || !itemName.trim()) return;
    const safeReceiptUrl = sanitizeHttpUrl(receiptUrl);

    if (editingItem) {
      const next = budgets.map((b) =>
        b.id === editingItem.id
          ? {
              ...b,
              event_id: b.event_id || activeEvent.id,
              section: itemSection,
              item_name: itemName.trim(),
              estimated_amount: Number(estAmount) || 0,
              actual_amount: Number(actAmount) || 0,
              receipt_photo_url: safeReceiptUrl,
              notes: notes.trim() || null,
            }
          : b
      );
      persistBudgets(next);
    } else {
      const newItem: EventBudgetLedgerItem = {
        id: `b-${Date.now()}`,
        event_id: activeEvent.id,
        section: itemSection,
        item_name: itemName.trim(),
        estimated_amount: Number(estAmount) || 0,
        actual_amount: Number(actAmount) || 0,
        receipt_photo_url: safeReceiptUrl,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      };
      persistBudgets([newItem, ...budgets]);
    }

    setEditingItem(null);
    setItemName("");
    setEstAmount("");
    setActAmount("");
    setReceiptUrl("");
    setNotes("");
    setIsModalOpen(false);
  };

  const handleDeleteBudget = (id: string) => {
    if (!canEdit) return;
    persistBudgets(budgets.filter((b) => b.id !== id));
  };

  if (accessMode === "LOCKED") {
    return (
      <Card className="p-8 text-center space-y-2.5 border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900">Akses Pembiayaan Dibatasi</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Menu Pembiayaan &amp; Anggaran hanya dapat dilihat oleh Ketua, Wakil, Sekretaris, Section Leader, dan dikelola oleh Bendahara.
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
            <span>Pembiayaan &amp; Anggaran Event</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan estimasi dan realisasi anggaran seluruh seksi untuk{" "}
            <strong className="text-slate-700">{activeEvent.title}</strong>.
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
            <span>Catat Biaya</span>
          </Button>
        )}
      </div>

      {/* Monitoring Banner */}
      {accessMode === "MONITOR" && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-2.5 text-xs text-indigo-800">
          <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Mode Monitoring (Read-Only):</strong> Anda melihat laporan pembiayaan sebagai pimpinan/section leader. Penambahan dan perubahan data hanya dapat dilakukan oleh <strong>Bendahara</strong>.
          </span>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Estimasi
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
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["ALL", "ACARA", "DEKORASI", "PERLENGKAPAN", "PDD", "INTI"] as const).map((sec) => (
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
            {sec === "ALL" ? "Semua Seksi" : sec}
          </button>
        ))}
      </div>

      {/* Budget List */}
      {filteredBudgets.length === 0 ? (
        <Card className="p-8 text-center text-xs text-slate-400">
          Belum ada catatan pembiayaan untuk filter ini.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBudgets.map((b) => (
            <Card key={b.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      b.section === "DEKORASI"
                        ? "pink"
                        : b.section === "ACARA"
                        ? "purple"
                        : b.section === "PERLENGKAPAN"
                        ? "orange"
                        : b.section === "PDD"
                        ? "sky"
                        : "neutral"
                    }
                    className="text-[10px]"
                  >
                    {b.section}
                  </Badge>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5">{b.item_name}</div>
                {b.notes && <div className="text-xs text-slate-500 mt-0.5">{b.notes}</div>}
                {sanitizeHttpUrl(b.receipt_photo_url) && (
                  <a
                    href={sanitizeHttpUrl(b.receipt_photo_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Lihat Nota</span>
                  </a>
                )}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-mono font-extrabold text-emerald-600">
                    {formatCurrencyIDR(b.actual_amount)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Est: {formatCurrencyIDR(b.estimated_amount)}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition"
                      title="Edit estimasi / biaya aktual"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Aktual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(b.id)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
                      title="Hapus catatan biaya"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit Biaya */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? "Edit Pembiayaan & Biaya Aktual" : "Catat Pembiayaan / Anggaran"}
        description={
          editingItem
            ? "Perbarui biaya aktual/realisasi, estimasi, atau catatan item ini."
            : "Tambahkan item pengeluaran atau estimasi anggaran event."
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Seksi / Divisi</label>
            <select
              value={itemSection}
              onChange={(e) => setItemSection(e.target.value as SectionType)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            >
              <option value="DEKORASI">DEKORASI</option>
              <option value="ACARA">ACARA</option>
              <option value="PERLENGKAPAN">PERLENGKAPAN</option>
              <option value="PDD">PDD</option>
              <option value="INTI">INTI</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Nama Item / Keperluan
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Contoh: Ornamen Bintang & Lampu LED"
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Estimasi (Rp)
              </label>
              <input
                type="number"
                value={estAmount}
                onChange={(e) => setEstAmount(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-emerald-700 block mb-1">
                Biaya Aktual / Realisasi (Rp)
              </label>
              <input
                type="number"
                value={actAmount}
                onChange={(e) => setActAmount(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 rounded-xl bg-emerald-50/30 border border-emerald-300 focus:border-emerald-500 focus:outline-none text-xs sm:text-sm text-slate-900 font-mono font-bold"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              URL Foto Nota / Kwitansi (opsional)
            </label>
            <input
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://..."
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Catatan (opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Vendor, nomor invoice, atau keterangan lainnya"
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
            <Button variant="emerald" size="sm" onClick={handleSaveBudget}>
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              {editingItem ? "Simpan Perubahan" : "Simpan Biaya"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
