"use client";

import React, { useState } from "react";
import { RundownItem, SectionType, User } from "@/types/domain";
import { getUsersBySection } from "@/lib/mock-db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Clock,
  User as UserIcon,
  Edit2,
  BookTemplate,
  GripVertical,
  RefreshCw,
} from "lucide-react";

interface RundownTemplate {
  id: string;
  name: string;
  label: string;
  items: Array<{
    title: string;
    section_pic: SectionType;
    estimated_duration_minutes: number;
    technical_notes?: string;
    cue_props?: string;
  }>;
}

const RUNDOWN_TEMPLATES: RundownTemplate[] = [
  {
    id: "tpl-natal",
    name: "Kebaktian Natal",
    label: "Kebaktian Natal",
    items: [
      { title: "Open Gate & Musik Instrumen", section_pic: "ACARA", estimated_duration_minutes: 30, technical_notes: "Lampu ambient 50%, usher standby di pintu" },
      { title: "Opening & Pujian Penyembahan", section_pic: "ACARA", estimated_duration_minutes: 25, cue_props: "Lirik di LED, mic WL 4 unit" },
      { title: "Teatrikal / Penampilan Kelas Anak", section_pic: "ACARA", estimated_duration_minutes: 20, cue_props: "Gate kiri masuk, gate kanan keluar" },
      { title: "Firman Tuhan", section_pic: "ACARA", estimated_duration_minutes: 35, technical_notes: "Spotlight mimbar" },
      { title: "Candle Light Service (Malam Kudus)", section_pic: "PERLENGKAPAN", estimated_duration_minutes: 15, cue_props: "Lampu fade-out 10 detik, 500 lilin jemaat" },
      { title: "Doa Berkat & Ramah Tamah", section_pic: "ACARA", estimated_duration_minutes: 15 },
    ],
  },
  {
    id: "tpl-paskah",
    name: "Paskah / Teatrikal",
    label: "Paskah / Teatrikal",
    items: [
      { title: "Open Gate & Registrasi", section_pic: "ACARA", estimated_duration_minutes: 20 },
      { title: "Prolog & Praise & Worship", section_pic: "ACARA", estimated_duration_minutes: 25 },
      { title: "Drama Teatrikal Jalan Salib", section_pic: "PERLENGKAPAN", estimated_duration_minutes: 35, technical_notes: "Smoke machine & lighting dramatis", cue_props: "Properti salib & kostum" },
      { title: "Refleksi Paskah & Perjamuan Kudus", section_pic: "ACARA", estimated_duration_minutes: 30, cue_props: "Nampan perjamuan siap" },
      { title: "Closing & Foto Bersama", section_pic: "PDD", estimated_duration_minutes: 15 },
    ],
  },
  {
    id: "tpl-seminar",
    name: "Seminar / KKR",
    label: "Seminar / KKR",
    items: [
      { title: "Open Gate & Check-in Peserta", section_pic: "ACARA", estimated_duration_minutes: 30 },
      { title: "Ice Breaking & Worship", section_pic: "ACARA", estimated_duration_minutes: 20 },
      { title: "Sesi 1: Pemaparan Materi", section_pic: "ACARA", estimated_duration_minutes: 45, technical_notes: "Slide presentasi & mic clip-on" },
      { title: "Sesi Tanya Jawab & Diskusi", section_pic: "ACARA", estimated_duration_minutes: 20, cue_props: "2 mic wireless untuk peserta" },
      { title: "Altar Call / Komitmen & Penutup", section_pic: "ACARA", estimated_duration_minutes: 20 },
    ],
  },
];

function addMinutesToTime(startTime: string, minutesToAdd: number): string {
  const [hStr, mStr] = startTime.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return "--:--";
  const total = h * 60 + m + minutesToAdd;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

interface RundownBuilderViewProps {
  items: RundownItem[];
  users: User[];
  onUpdateItems: (items: RundownItem[]) => void;
  isLocked?: boolean;
  eventTitle?: string;
  eventId?: string;
}

export function RundownBuilderView({
  items,
  users,
  onUpdateItems,
  isLocked = false,
  eventTitle,
}: RundownBuilderViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RundownItem | null>(null);
  const [openGateTime, setOpenGateTime] = useState("17:00");

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [sectionPic, setSectionPic] = useState<SectionType>("ACARA");
  const [duration, setDuration] = useState(15);
  const [plannedTime, setPlannedTime] = useState("17:00");
  const [picUserId, setPicUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [cueProps, setCueProps] = useState("");

  const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index);
  const totalMinutes = items.reduce((acc, it) => acc + (it.estimated_duration_minutes || 0), 0);
  const estimatedEndTime = addMinutesToTime(openGateTime, totalMinutes);

  const handleLoadTemplate = (template: RundownTemplate) => {
    if (isLocked) return;
    let cursor = openGateTime;
    const rundownId = sortedItems[0]?.rundown_id || "rnd-default";
    const generated: RundownItem[] = template.items.map((tplItem, idx) => {
      const start = cursor;
      cursor = addMinutesToTime(cursor, tplItem.estimated_duration_minutes);
      return {
        id: `rnd-item-${Date.now()}-${idx}`,
        rundown_id: rundownId,
        order_index: idx + 1,
        title: tplItem.title,
        section_pic: tplItem.section_pic,
        estimated_duration_minutes: tplItem.estimated_duration_minutes,
        planned_start_time: start,
        pic_user_id: null,
        status: "PENDING",
        technical_notes: tplItem.technical_notes || "",
        cue_props: tplItem.cue_props || "",
      };
    });
    onUpdateItems(generated);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setTitle("");
    setSectionPic("ACARA");
    setDuration(15);
    setPlannedTime(estimatedEndTime !== "--:--" ? estimatedEndTime : openGateTime);
    setPicUserId("");
    setNotes("");
    setCueProps("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RundownItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setSectionPic(item.section_pic);
    setDuration(item.estimated_duration_minutes);
    setPlannedTime(item.planned_start_time || openGateTime);
    setPicUserId(item.pic_user_id || "");
    setNotes(item.technical_notes || "");
    setCueProps(item.cue_props || "");
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!title.trim()) return;

    if (editingItem) {
      const updated = sortedItems.map((it) =>
        it.id === editingItem.id
          ? {
              ...it,
              title,
              section_pic: sectionPic,
              estimated_duration_minutes: duration,
              planned_start_time: plannedTime,
              pic_user_id: picUserId || null,
              technical_notes: notes,
              cue_props: cueProps,
            }
          : it
      );
      onUpdateItems(updated);
    } else {
      const newItem: RundownItem = {
        id: `rnd-item-${Date.now()}`,
        rundown_id: sortedItems[0]?.rundown_id || "rnd-default",
        order_index: sortedItems.length + 1,
        title,
        section_pic: sectionPic,
        estimated_duration_minutes: duration,
        planned_start_time: plannedTime,
        pic_user_id: picUserId || null,
        status: "PENDING",
        technical_notes: notes,
        cue_props: cueProps,
      };
      onUpdateItems([...sortedItems, newItem]);
    }

    setIsModalOpen(false);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (isLocked) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedItems.length) return;

    const newItems = [...sortedItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const reordered = newItems.map((it, idx) => ({ ...it, order_index: idx + 1 }));
    onUpdateItems(reordered);
  };

  const handleDropReorder = (targetIndex: number) => {
    if (isLocked || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newItems = [...sortedItems];
    const [moved] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, moved);
    const reordered = newItems.map((it, idx) => ({ ...it, order_index: idx + 1 }));
    onUpdateItems(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDelete = (id: string) => {
    if (isLocked) return;
    const filtered = sortedItems.filter((it) => it.id !== id);
    const reordered = filtered.map((it, idx) => ({ ...it, order_index: idx + 1 }));
    onUpdateItems(reordered);
  };

  const handleAutoSyncStartTimes = () => {
    if (isLocked) return;
    let cursor = openGateTime;
    const synced = sortedItems.map((it) => {
      const start = cursor;
      cursor = addMinutesToTime(cursor, it.estimated_duration_minutes || 0);
      return { ...it, planned_start_time: start };
    });
    onUpdateItems(synced);
  };

  const handleResetDraft = () => {
    if (isLocked) return;
    onUpdateItems([]);
  };

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Summary Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                {eventTitle ? `Rundown: ${eventTitle}` : "Susunan Rundown Acara"}
              </h2>
              <Badge variant="purple" className="text-[11px]">
                {sortedItems.length} Segmen
              </Badge>
              {isLocked && (
                <Badge variant="crimson" className="text-[10px]">LOCKED LIVE</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Total: {totalMinutes}m ({Math.floor(totalMinutes / 60)}j {totalMinutes % 60}m) · Estimasi Selesai:{" "}
              <strong className="text-emerald-600">{estimatedEndTime}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-600">Open Gate:</span>
              <input
                type="time"
                value={openGateTime}
                onChange={(e) => setOpenGateTime(e.target.value)}
                disabled={isLocked}
                className="bg-transparent text-xs font-mono font-bold text-indigo-700 focus:outline-none"
              />
            </div>

            {!isLocked && (
              <Button size="sm" variant="primary" onClick={handleOpenAdd} className="font-bold gap-1 text-xs">
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Menu Bar Rundown Builder */}
      {!isLocked && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-indigo-700 font-extrabold">
              <BookTemplate className="w-4 h-4 text-indigo-600" />
              <span>Template &amp; Alat Rundown</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAutoSyncStartTimes}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 transition"
              >
                <RefreshCw className="w-3 h-3" />
                Auto-Sync Jam Mulai
              </button>
              <button
                type="button"
                onClick={handleResetDraft}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 transition"
              >
                Reset Draft
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {RUNDOWN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleLoadTemplate(tpl)}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 hover:text-indigo-700 transition text-center truncate"
                title={`Muat template ${tpl.label}`}
              >
                Template: {tpl.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Drag & Drop Rundown List */}
      <div className="space-y-2.5">
        {sortedItems.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-400">
            Belum ada segmen rundown. Pilih template di atas atau klik tombol &ldquo;+ Add Segment&rdquo; di bawah.
          </Card>
        ) : (
          sortedItems.map((item, idx) => {
            const picUser = users.find((u) => u.id === item.pic_user_id);
            const isFinished = item.status === "FINISHED";
            const isActive = item.status === "ACTIVE";
            const isDragTarget = dragOverIndex === idx && draggedIndex !== idx;
            const formattedDuration = String(item.estimated_duration_minutes || 0).padStart(2, "0");

            return (
              <div
                key={item.id}
                draggable={!isLocked}
                onDragStart={() => setDraggedIndex(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropReorder(idx);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`rounded-2xl bg-white border p-4 transition-all ${
                  isActive
                    ? "border-emerald-300 shadow-neon-emerald"
                    : isDragTarget
                    ? "border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-slate-200/90 hover:border-indigo-200 shadow-xs"
                } ${isFinished ? "opacity-65 bg-slate-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {!isLocked && (
                      <div
                        className="mt-1 text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing shrink-0"
                        title="Tarik untuk mengubah urutan"
                      >
                        <GripVertical className="w-5 h-5" />
                      </div>
                    )}

                    <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {item.planned_start_time || "--:--"} for {formattedDuration}m
                        </span>
                        <Badge
                          variant={
                            item.section_pic === "ACARA"
                              ? "purple"
                              : item.section_pic === "PDD"
                              ? "sky"
                              : item.section_pic === "PERLENGKAPAN"
                              ? "orange"
                              : "pink"
                          }
                          className="text-[10px] py-0 px-2"
                        >
                          {item.section_pic}
                        </Badge>
                        {isActive && (
                          <Badge variant="emerald" pulse className="text-[10px] py-0 px-2">
                            ACTIVE
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1.5 leading-snug">
                        {item.title}
                      </h3>

                      {picUser && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>PIC: {picUser.full_name.split(" ")[0]}</span>
                        </div>
                      )}

                      {item.technical_notes && (
                        <p className="text-xs text-slate-500 mt-1 italic border-l-2 border-indigo-300 pl-2">
                          Teknis: {item.technical_notes}
                        </p>
                      )}

                      {item.cue_props && (
                        <p className="text-xs text-amber-700 font-medium mt-1">
                          Props/Cue: {item.cue_props}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isLocked && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, "up")}
                        aria-label="Naikkan segmen"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sortedItems.length - 1}
                        onClick={() => handleMove(idx, "down")}
                        aria-label="Turunkan segmen"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        aria-label="Edit segmen"
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label="Hapus segmen"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Full-Width Bottom + Add Segment CTA */}
        {!isLocked && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Segment</span>
          </button>
        )}
      </div>

      {/* Modal Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Segmen Rundown" : "Tambah Segmen Rundown"}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Nama Kegiatan / Acara</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Candle Light Service (Malam Kudus)"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Section</label>
              <select
                value={sectionPic}
                onChange={(e) => setSectionPic(e.target.value as SectionType)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="ACARA">ACARA</option>
                <option value="DEKORASI">DEKORASI</option>
                <option value="PERLENGKAPAN">PERLENGKAPAN</option>
                <option value="PDD">PDD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Durasi (m)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Jam Mulai</label>
              <input
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">PIC (Penanggung Jawab)</label>
            <select
              value={picUserId}
              onChange={(e) => setPicUserId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Tanpa PIC Khusus --</option>
              {getUsersBySection(users, sectionPic).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.base_role.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Teknis / Flow Panggung</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruksi lighting, gate in-out, audio cue..."
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Kebutuhan Alat / Props / Slide</label>
            <input
              type="text"
              value={cueProps}
              onChange={(e) => setCueProps(e.target.value)}
              placeholder="Contoh: Lilin induk, mic wireless 2, video PPT..."
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <Button size="lg" variant="primary" onClick={handleSaveItem} className="w-full font-bold">
            {editingItem ? "Simpan Perubahan" : "Tambahkan ke Rundown"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
