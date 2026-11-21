"use client";

import React, { useEffect, useState } from "react";
import {
  Event,
  EventCommitteeMember,
  EventMinisterRow,
  User,
} from "@/types/domain";
import {
  INITIAL_EVENT,
  getNotesAccessMode,
  isCreativeLeader,
} from "@/lib/mock-db";
import { publishSyncMessage, subscribeSyncMessages } from "@/lib/sync/realtime-bus";
import { MeetingNotesView } from "@/features/meeting-notes/meeting-notes-view";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  Mic2,
  Network,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

type SecretariatSubTab = "NOTULENSI" | "STRUKTUR_PANITIA" | "STRUKTUR_PELAYAN";

const DEFAULT_COMMITTEE_POSITIONS = [
  "Koordinator Acara",
  "Wakil Koordinator",
  "Bendahara",
  "Sekretaris",
  "Seksi Acara",
  "Seksi Dekorasi",
  "Seksi Perlengkapan, Dokumentasi & Sound",
  "Seksi Musik",
  "Seksi Konsumsi",
  "Seksi Dana",
  "Seksi Doa",
];

const DEFAULT_MINISTER_POSITIONS = [
  { role: "Pembicara / Pengkhotbah", notes: "Sesi Firman / Renungan" },
  { role: "MC", notes: "Host utama acara" },
  { role: "Song Leader / WL", notes: "Praise & Worship" },
  { role: "Singer", notes: "Backing vocal / Worship" },
  { role: "Team Musik", notes: "Keyboard, Gitar, Bass, Drum" },
  { role: "Multimedia / LCD", notes: "Slide, video, countdown" },
  { role: "Soundsystem", notes: "Audio & mixer" },
  { role: "Team Tambourine / Tari", notes: "Penampilan pembuka / khusus" },
  { role: "Usher", notes: "Penyambutan & penertiban" },
  { role: "Kolektan", notes: "Pengumpulan persembahan" },
  { role: "Juri / Pengisi Khusus", notes: "Penilaian / sesi khusus" },
];

interface SecretariatViewProps {
  users: User[];
  currentUser: User | null;
  activeEvent?: Event;
}

export function SecretariatView({
  users,
  currentUser,
  activeEvent = INITIAL_EVENT,
}: SecretariatViewProps) {
  const accessMode = getNotesAccessMode(currentUser);
  const canEdit = accessMode === "EDIT" || isCreativeLeader(currentUser);

  const [subTab, setSubTab] = useState<SecretariatSubTab>("NOTULENSI");
  const [committee, setCommittee] = useState<EventCommitteeMember[]>([]);
  const [ministers, setMinisters] = useState<EventMinisterRow[]>([]);
  const [savingCommittee, setSavingCommittee] = useState(false);
  const [savingMinisters, setSavingMinisters] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const committeeStorageKey = `CT_SECRETARIAT_COMMITTEE_${activeEvent.id}`;
  const ministersStorageKey = `CT_SECRETARIAT_MINISTERS_${activeEvent.id}`;

  useEffect(() => {
    if (!activeEvent.id) return;
    try {
      const rawC = localStorage.getItem(committeeStorageKey);
      if (rawC) setCommittee(JSON.parse(rawC) as EventCommitteeMember[]);
      const rawM = localStorage.getItem(ministersStorageKey);
      if (rawM) setMinisters(JSON.parse(rawM) as EventMinisterRow[]);
    } catch {}

    let mounted = true;
    fetch(`/api/events/${activeEvent.id}/secretariat`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.success) return;
        if (Array.isArray(data.committee)) {
          setCommittee(data.committee);
          try {
            localStorage.setItem(committeeStorageKey, JSON.stringify(data.committee));
          } catch {}
        }
        if (Array.isArray(data.ministers)) {
          setMinisters(data.ministers);
          try {
            localStorage.setItem(ministersStorageKey, JSON.stringify(data.ministers));
          } catch {}
        }
      })
      .catch(() => {});

    const unsub = subscribeSyncMessages((msg) => {
      if (msg.key === "CT_SECRETARIAT_COMMITTEE" && Array.isArray(msg.payload)) {
        const list = (msg.payload as EventCommitteeMember[]).filter(
          (r) => r.event_id === activeEvent.id
        );
        if (list.length > 0 || (msg.payload as EventCommitteeMember[]).length === 0) {
          setCommittee(list);
        }
      }
      if (msg.key === "CT_SECRETARIAT_MINISTERS" && Array.isArray(msg.payload)) {
        const list = (msg.payload as EventMinisterRow[]).filter(
          (r) => r.event_id === activeEvent.id
        );
        if (list.length > 0 || (msg.payload as EventMinisterRow[]).length === 0) {
          setMinisters(list);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [activeEvent.id, committeeStorageKey, ministersStorageKey]);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Committee Builder Helpers
  const handleInitCommitteePreset = () => {
    const preset: EventCommitteeMember[] = DEFAULT_COMMITTEE_POSITIONS.map((pos, idx) => ({
      id: `cm-new-${Date.now()}-${idx}`,
      event_id: activeEvent.id,
      order_index: idx,
      position_name: pos,
      pic_user_id: null,
      pic_name: "",
      contact_notes: "",
    }));
    setCommittee(preset);
  };

  const handleSaveCommittee = async () => {
    if (!canEdit || !activeEvent.id) return;
    setSavingCommittee(true);
    const sanitized = committee
      .filter((r) => r.position_name.trim() && r.pic_name.trim())
      .map((r, idx) => ({
        ...r,
        order_index: idx,
        position_name: r.position_name.trim(),
        pic_name: r.pic_name.trim(),
        contact_notes: r.contact_notes?.trim() || "",
      }));

    try {
      const res = await fetch(`/api/events/${activeEvent.id}/secretariat`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "committee", rows: sanitized }),
      });
      const data = await res.json();
      const finalRows = data?.success && Array.isArray(data.committee) ? data.committee : sanitized;
      setCommittee(finalRows);
      try {
        localStorage.setItem(committeeStorageKey, JSON.stringify(finalRows));
        publishSyncMessage("CT_SECRETARIAT_COMMITTEE", finalRows);
      } catch {}
      showToast("Struktur Panitia disimpan & otomatis tersinkron ke Dokumen Project Brief.");
    } finally {
      setSavingCommittee(false);
    }
  };

  // Ministers Structure Helpers
  const handleInitMinistersPreset = () => {
    const preset: EventMinisterRow[] = DEFAULT_MINISTER_POSITIONS.map((item, idx) => ({
      id: `mnr-new-${Date.now()}-${idx}`,
      event_id: activeEvent.id,
      order_index: idx,
      ministry_role: item.role,
      minister_names: "",
      notes: item.notes,
    }));
    setMinisters(preset);
  };

  const handleSaveMinisters = async () => {
    if (!canEdit || !activeEvent.id) return;
    setSavingMinisters(true);
    const sanitized = ministers
      .filter((r) => r.ministry_role.trim() && r.minister_names.trim())
      .map((r, idx) => ({
        ...r,
        order_index: idx,
        ministry_role: r.ministry_role.trim(),
        minister_names: r.minister_names.trim(),
        notes: r.notes?.trim() || "",
      }));

    try {
      const res = await fetch(`/api/events/${activeEvent.id}/secretariat`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ministers", rows: sanitized }),
      });
      const data = await res.json();
      const finalRows = data?.success && Array.isArray(data.ministers) ? data.ministers : sanitized;
      setMinisters(finalRows);
      try {
        localStorage.setItem(ministersStorageKey, JSON.stringify(finalRows));
        publishSyncMessage("CT_SECRETARIAT_MINISTERS", finalRows);
      } catch {}
      showToast("Struktur Pelayan disimpan & otomatis tersinkron ke Dokumen Project Brief.");
    } finally {
      setSavingMinisters(false);
    }
  };

  const moveRow = <T,>(arr: T[], idx: number, dir: -1 | 1): T[] => {
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return arr;
    const copy = [...arr];
    const [picked] = copy.splice(idx, 1);
    copy.splice(target, 0, picked);
    return copy;
  };

  if (accessMode === "LOCKED") {
    return (
      <Card className="p-8 text-center space-y-2.5 border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900">Akses Sekretariat Dibatasi</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Menu Sekretariat hanya dapat dibuka oleh tim inti, koordinator seksi, dan dikelola penuh oleh Sekretaris.
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
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Sekretariat Terpadu</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola Notulensi Rapat, Struktur Panitia, dan Struktur Pelayan untuk{" "}
            <strong className="text-slate-700">{activeEvent.title}</strong>.
          </p>
        </div>

        <Badge variant="purple" className="text-[11px]">
          Auto-Sync ke Template Dokumen
        </Badge>
      </div>

      {!canEdit && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-2.5 text-xs text-indigo-800">
          <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Mode Monitoring (Read-Only):</strong> Perubahan notulensi dan struktur hanya dilakukan oleh <strong>Sekretaris</strong> / <strong>Creative Leader</strong>.
          </span>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 3 Sub-Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "NOTULENSI", label: "1. Notulensi Rapat", icon: FileText },
          {
            id: "STRUKTUR_PANITIA",
            label: `2. Struktur Builder (${committee.length})`,
            icon: Network,
          },
          {
            id: "STRUKTUR_PELAYAN",
            label: `3. Struktur Pelayan (${ministers.length})`,
            icon: Mic2,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as SecretariatSubTab)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                active
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content */}
      {subTab === "NOTULENSI" && (
        <MeetingNotesView
          users={users}
          currentUser={currentUser}
          activeEvent={activeEvent}
          readOnly={!canEdit}
        />
      )}

      {subTab === "STRUKTUR_PANITIA" && (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5 space-y-4 border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  05. Struktur Panitia (Key People &amp; PIC)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Otomatis mengisi tabel Bagian 05 pada Dokumen Event Project Brief (.docx &amp; .pdf).
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {committee.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleInitCommitteePreset}
                      className="text-xs gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Muat Preset Template</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCommittee((prev) => [
                        ...prev,
                        {
                          id: `cm-new-${Date.now()}`,
                          event_id: activeEvent.id,
                          order_index: prev.length,
                          position_name: "",
                          pic_user_id: null,
                          pic_name: "",
                          contact_notes: "",
                        },
                      ])
                    }
                    className="text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Posisi</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={savingCommittee}
                    onClick={handleSaveCommittee}
                    className="text-xs gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingCommittee ? "Menyimpan..." : "Simpan Struktur"}</span>
                  </Button>
                </div>
              )}
            </div>

            {committee.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Belum ada baris struktur panitia. Klik <strong>Muat Preset Template</strong> atau{" "}
                <strong>Tambah Posisi</strong> untuk mulai menyusun.
              </div>
            ) : (
              <div className="space-y-2.5">
                {committee.map((row, idx) => (
                  <div
                    key={row.id || idx}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200 items-center"
                  >
                    <div className="lg:col-span-4">
                      <label className="block lg:hidden text-[10px] font-bold text-slate-400 mb-1">
                        Jabatan / Seksi
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.position_name}
                        onChange={(e) =>
                          setCommittee((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, position_name: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Contoh: Koordinator Acara"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="lg:col-span-4 space-y-1.5">
                      <select
                        disabled={!canEdit}
                        value={row.pic_user_id || ""}
                        onChange={(e) => {
                          const picked = users.find((u) => u.id === e.target.value);
                          setCommittee((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? {
                                    ...item,
                                    pic_user_id: picked?.id || null,
                                    pic_name: picked ? picked.full_name : item.pic_name,
                                    contact_notes:
                                      picked?.phone && !item.contact_notes
                                        ? picked.phone
                                        : item.contact_notes,
                                  }
                                : item
                            )
                          );
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-600"
                      >
                        <option value="">-- Pilih dari Anggota Terdaftar (Opsional) --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.base_role})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.pic_name}
                        onChange={(e) =>
                          setCommittee((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, pic_name: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Nama PIC / Penanggung Jawab"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.contact_notes || ""}
                        onChange={(e) =>
                          setCommittee((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, contact_notes: e.target.value } : item
                            )
                          )
                        }
                        placeholder="No. HP / Catatan"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                      />
                    </div>

                    {canEdit && (
                      <div className="lg:col-span-1 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setCommittee((prev) => moveRow(prev, idx, -1))}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600"
                          title="Geser atas"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommittee((prev) => moveRow(prev, idx, 1))}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600"
                          title="Geser bawah"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCommittee((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-rose-500 hover:bg-rose-50"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {subTab === "STRUKTUR_PELAYAN" && (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5 space-y-4 border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  06. Daftar Pelayan Acara
                </h3>
                <p className="text-[11px] text-slate-500">
                  Otomatis mengisi tabel Bagian 06 pada Dokumen Event Project Brief (.docx &amp; .pdf).
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {ministers.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleInitMinistersPreset}
                      className="text-xs gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Muat Preset Template</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setMinisters((prev) => [
                        ...prev,
                        {
                          id: `mnr-new-${Date.now()}`,
                          event_id: activeEvent.id,
                          order_index: prev.length,
                          ministry_role: "",
                          minister_names: "",
                          notes: "",
                        },
                      ])
                    }
                    className="text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tim Pelayan</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={savingMinisters}
                    onClick={handleSaveMinisters}
                    className="text-xs gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingMinisters ? "Menyimpan..." : "Simpan Daftar Pelayan"}</span>
                  </Button>
                </div>
              )}
            </div>

            {ministers.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Belum ada daftar pelayan acara. Klik <strong>Muat Preset Template</strong> atau{" "}
                <strong>Tambah Tim Pelayan</strong> untuk mulai mengisi.
              </div>
            ) : (
              <div className="space-y-2.5">
                {ministers.map((row, idx) => (
                  <div
                    key={row.id || idx}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200 items-center"
                  >
                    <div className="lg:col-span-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.ministry_role}
                        onChange={(e) =>
                          setMinisters((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, ministry_role: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Posisi / Tim (mis: MC, Singer)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div className="lg:col-span-5">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.minister_names}
                        onChange={(e) =>
                          setMinisters((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, minister_names: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Daftar nama pelayan (mis: Kak Febe, Kak Luna)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={row.notes || ""}
                        onChange={(e) =>
                          setMinisters((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, notes: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Keterangan"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                      />
                    </div>
                    {canEdit && (
                      <div className="lg:col-span-1 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setMinisters((prev) => moveRow(prev, idx, -1))}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600"
                          title="Geser atas"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMinisters((prev) => moveRow(prev, idx, 1))}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600"
                          title="Geser bawah"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMinisters((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-rose-500 hover:bg-rose-50"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
