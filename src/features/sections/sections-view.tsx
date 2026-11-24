"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  INITIAL_EVENT,
  INITIAL_PDD_REFERENCES,
  INITIAL_ROSTER,
  canManageEventRoster,
  getSectionAccessMode,
} from "@/lib/mock-db";
import { publishSyncMessage } from "@/lib/sync/realtime-bus";
import { MeetingNotesView } from "@/features/meeting-notes/meeting-notes-view";
import { RundownBuilderView } from "@/features/rundown-builder/rundown-builder-view";
import {
  Event,
  EventRosterMember,
  SectionType,
  User,
  EventTechnicalGuide,
  SectionToolInventory,
  SectionPddShotlist,
  EventBudgetLedgerItem,
  SectionDecorItem,
  DecorInstallationStatus,
  PddDriveReference,
  TaskPhase,
  RundownItem,
} from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrencyIDR, sanitizeHttpUrl } from "@/lib/utils";
import {
  Wrench,
  Video,
  FileText,
  DollarSign,
  CheckCircle,
  ExternalLink,
  Plus,
  Lock,
  Eye,
  Presentation,
  ListOrdered,
  Users,
} from "lucide-react";

interface SectionsViewProps {
  users: User[];
  currentUser: User | null;
  activeEvent?: Event;
  roster?: EventRosterMember[];
  items?: RundownItem[];
  onUpdateItems?: (newItems: RundownItem[]) => void;
  isRundownLocked?: boolean;
}

type SectionsTab = SectionType;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // Fallback to default
  }
  return fallback;
}

export function SectionsView({
  users,
  currentUser,
  activeEvent = INITIAL_EVENT,
  roster = INITIAL_ROSTER,
  items = [],
  onUpdateItems = () => {},
  isRundownLocked = false,
}: SectionsViewProps) {
  const [acaraSubTab, setAcaraSubTab] = useState<"RUNDOWN" | "CUE_CARDS">("RUNDOWN");
  const [activeSection, setActiveSection] = useState<SectionsTab>("ACARA");

  const sectionTabs: SectionsTab[] = ["ACARA", "DEKORASI", "PERLENGKAPAN", "PDD"];
  const accessMode = getSectionAccessMode(currentUser, activeEvent, roster, activeSection);
  const canEdit = accessMode === "EDIT";

  useEffect(() => {
    const currentMode = getSectionAccessMode(currentUser, activeEvent, roster, activeSection);
    if (currentMode === "LOCKED") {
      const firstAllowed = sectionTabs.find(
        (sec) => getSectionAccessMode(currentUser, activeEvent, roster, sec) !== "LOCKED"
      );
      if (firstAllowed) {
        setActiveSection(firstAllowed);
      }
    }
  }, [currentUser, activeEvent.id, roster]);

  const [tools, setTools] = useState<SectionToolInventory[]>([]);

  const [budgets, setBudgets] = useState<EventBudgetLedgerItem[]>([]);

  const [shotlists, setShotlists] = useState<SectionPddShotlist[]>([]);

  const [guides, setGuides] = useState<EventTechnicalGuide[]>([]);

  const [decorItems, setDecorItems] = useState<SectionDecorItem[]>([]);

  const [pddReferences, setPddReferences] = useState<PddDriveReference[]>(INITIAL_PDD_REFERENCES);
  const [pddPhaseFilter, setPddPhaseFilter] = useState<"ALL" | TaskPhase>("ALL");
  const [isDriveRefModalOpen, setIsDriveRefModalOpen] = useState(false);
  const [driveRefTitle, setDriveRefTitle] = useState("");
  const [driveRefUrl, setDriveRefUrl] = useState("");
  const [driveRefPhase, setDriveRefPhase] = useState<TaskPhase>("PRE_EVENT");

  const [isCueModalOpen, setIsCueModalOpen] = useState(false);
  const [cueTitle, setCueTitle] = useState("");
  const [cueCategory, setCueCategory] = useState("STAGE_LAYOUT");
  const [cueInstructions, setCueInstructions] = useState("");
  const [cueImageUrl, setCueImageUrl] = useState("");

  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<1 | 1.5 | 2>(1);

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetItemName, setBudgetItemName] = useState("");
  const [budgetEst, setBudgetEst] = useState("");
  const [budgetAct, setBudgetAct] = useState("");
  const [budgetReceiptUrl, setBudgetReceiptUrl] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");

  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [toolName, setToolName] = useState("");
  const [toolQty, setToolQty] = useState(1);
  const [toolSource, setToolSource] = useState<"IN_HOUSE" | "RENTAL" | "PURCHASE">("IN_HOUSE");
  const [toolNotes, setToolNotes] = useState("");

  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [shotTitle, setShotTitle] = useState("");
  const [shotType, setShotType] = useState<"PHOTO" | "VIDEO" | "REEL">("PHOTO");
  const [shotAngle, setShotAngle] = useState("");

  const toggleToolReady = (id: string) => {
    if (!canEdit) return;
    const target = tools.find((t) => t.id === id);
    const nextReady = target ? !target.is_ready : true;
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_ready: !t.is_ready } : t))
    );
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "tools", id, is_ready: nextReady }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    setTools((prev) => loadFromStorage("CT_SECTION_TOOLS", prev));
    setBudgets((prev) => loadFromStorage("CT_SECTION_BUDGETS", prev));
    setShotlists((prev) => loadFromStorage("CT_SECTION_SHOTLISTS", prev));
    setGuides((prev) => loadFromStorage("CT_SECTION_GUIDES", prev));
    setDecorItems((prev) => loadFromStorage("CT_SECTION_DECOR", prev));
    setPddReferences((prev) => loadFromStorage("CT_PDD_REFERENCES", prev));

    if (!activeEvent.id) return;
    let active = true;
    fetch(`/api/events/${activeEvent.id}/sections`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success) return;
        if (Array.isArray(data.tools) && data.tools.length > 0) setTools(data.tools);
        if (Array.isArray(data.decor) && data.decor.length > 0) setDecorItems(data.decor);
        if (Array.isArray(data.shotlist) && data.shotlist.length > 0) setShotlists(data.shotlist);
        if (Array.isArray(data.references) && data.references.length > 0) setPddReferences(data.references);
        if (Array.isArray(data.guides) && data.guides.length > 0) setGuides(data.guides);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [activeEvent.id]);

  useEffect(() => {
    try {
      localStorage.setItem("CT_SECTION_TOOLS", JSON.stringify(tools));
    } catch {}
  }, [tools]);

  useEffect(() => {
    try {
      localStorage.setItem("CT_SECTION_BUDGETS", JSON.stringify(budgets));
    } catch {}
  }, [budgets]);

  useEffect(() => {
    try {
      localStorage.setItem("CT_SECTION_SHOTLISTS", JSON.stringify(shotlists));
    } catch {}
  }, [shotlists]);

  useEffect(() => {
    try {
      localStorage.setItem("CT_SECTION_GUIDES", JSON.stringify(guides));
      publishSyncMessage("CT_SECTION_GUIDES", guides);
    } catch {}
  }, [guides]);

  useEffect(() => {
    try {
      localStorage.setItem("CT_SECTION_DECOR", JSON.stringify(decorItems));
    } catch {}
  }, [decorItems]);

  useEffect(() => {
    try {
      localStorage.setItem("CT_PDD_REFERENCES", JSON.stringify(pddReferences));
    } catch {}
  }, [pddReferences]);

  const handleAddDriveReference = async () => {
    const safeUrl = sanitizeHttpUrl(driveRefUrl);
    if (!canEdit || !driveRefTitle.trim() || !safeUrl) return;
    const newRef: PddDriveReference = {
      id: `pdd-ref-${Date.now()}`,
      event_id: activeEvent.id,
      phase: driveRefPhase,
      title: driveRefTitle.trim(),
      url: safeUrl,
      created_at: new Date().toISOString(),
    };
    setPddReferences((prev) => [newRef, ...prev]);
    setDriveRefTitle("");
    setDriveRefUrl("");
    setIsDriveRefModalOpen(false);
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "references",
          phase: newRef.phase,
          title: newRef.title,
          url: newRef.url,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res?.item?.id) {
            setPddReferences((prev) => prev.map((it) => (it.id === newRef.id ? res.item : it)));
          }
        })
        .catch(() => {});
    }
  };

  const handleAddCueCard = () => {
    if (!canEdit || !cueTitle.trim() || !cueInstructions.trim()) return;
    const newGuide: EventTechnicalGuide = {
      id: `g-${Date.now()}`,
      event_id: activeEvent.id,
      category: cueCategory,
      title: cueTitle.trim(),
      instructions_markdown: cueInstructions.trim(),
      layout_image_url: sanitizeHttpUrl(cueImageUrl),
      target_sections: ["ACARA", "ALL"],
      created_at: new Date().toISOString(),
    };
    setGuides((prev) => [newGuide, ...prev]);
    setCueTitle("");
    setCueInstructions("");
    setCueImageUrl("");
    setIsCueModalOpen(false);
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "guides",
          category: newGuide.category,
          title: newGuide.title,
          instructions_markdown: newGuide.instructions_markdown,
          layout_image_url: newGuide.layout_image_url,
          target_sections: newGuide.target_sections,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res?.item?.id) {
            setGuides((prev) => prev.map((it) => (it.id === newGuide.id ? res.item : it)));
          }
        })
        .catch(() => {});
    }
  };

  const handleCycleDecorStatus = (id: string) => {
    if (!canEdit) return;
    const nextMap: Record<DecorInstallationStatus, DecorInstallationStatus> = {
      PLANNING: "IN_PROGRESS",
      IN_PROGRESS: "INSTALLED",
      INSTALLED: "READY",
      READY: "PLANNING",
    };
    const currentItem = decorItems.find((d) => d.id === id);
    const nextStatus = currentItem ? nextMap[currentItem.installation_status] : "IN_PROGRESS";
    setDecorItems((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, installation_status: nextMap[d.installation_status], updated_at: new Date().toISOString() }
          : d
      )
    );
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "decor", id, installation_status: nextStatus }),
      }).catch(() => {});
    }
  };

  const handleAddBudget = () => {
    if (!canEdit || !budgetItemName.trim()) return;
    const newBudget: EventBudgetLedgerItem = {
      id: `b-${Date.now()}`,
      event_id: activeEvent.id,
      section: "DEKORASI",
      item_name: budgetItemName.trim(),
      estimated_amount: Number(budgetEst) || 0,
      actual_amount: Number(budgetAct) || 0,
      receipt_photo_url: budgetReceiptUrl.trim() || null,
      notes: budgetNotes.trim() || null,
      created_at: new Date().toISOString(),
    };
    setBudgets((prev) => [newBudget, ...prev]);
    setBudgetItemName("");
    setBudgetEst("");
    setBudgetAct("");
    setBudgetReceiptUrl("");
    setBudgetNotes("");
    setIsBudgetModalOpen(false);
  };

  const handleAddTool = () => {
    if (!canEdit || !toolName.trim()) return;
    const newTool: SectionToolInventory = {
      id: `tool-${Date.now()}`,
      event_id: activeEvent.id,
      tool_name: toolName.trim(),
      quantity: toolQty || 1,
      source: toolSource,
      is_ready: false,
      notes: toolNotes.trim() || null,
    };
    setTools((prev) => [newTool, ...prev]);
    setToolName("");
    setToolQty(1);
    setToolNotes("");
    setIsToolModalOpen(false);
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "tools",
          tool_name: newTool.tool_name,
          quantity: newTool.quantity,
          source: newTool.source,
          is_ready: false,
          notes: newTool.notes,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res?.item?.id) {
            setTools((prev) => prev.map((it) => (it.id === newTool.id ? res.item : it)));
          }
        })
        .catch(() => {});
    }
  };

  const handleAddShotlist = () => {
    if (!canEdit || !shotTitle.trim()) return;
    const newShot: SectionPddShotlist = {
      id: `shot-${Date.now()}`,
      event_id: activeEvent.id,
      scene_title: shotTitle.trim(),
      shot_type: shotType,
      camera_angle: shotAngle.trim() || null,
      status: "PENDING",
      drive_link: pddReferences[0]?.url || "https://drive.google.com",
    };
    setShotlists((prev) => [newShot, ...prev]);
    setShotTitle("");
    setShotAngle("");
    setIsShotModalOpen(false);
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "shotlist",
          scene_title: newShot.scene_title,
          shot_type: newShot.shot_type,
          camera_angle: newShot.camera_angle,
          status: "PENDING",
          drive_link: newShot.drive_link,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res?.item?.id) {
            setShotlists((prev) => prev.map((it) => (it.id === newShot.id ? res.item : it)));
          }
        })
        .catch(() => {});
    }
  };

  const handleCycleShotStatus = (id: string) => {
    if (!canEdit) return;
    const nextMap: Record<SectionPddShotlist["status"], SectionPddShotlist["status"]> = {
      PENDING: "TAKEN",
      TAKEN: "EDITED",
      EDITED: "PENDING",
    };
    const curr = shotlists.find((s) => s.id === id);
    const nextStatus = curr ? nextMap[curr.status] : "TAKEN";
    setShotlists((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: nextMap[s.status] } : s))
    );
    if (activeEvent.id) {
      fetch(`/api/events/${activeEvent.id}/sections`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "shotlist", id, status: nextStatus }),
      }).catch(() => {});
    }
  };

  const eventGuides = guides.filter((g) => (g.event_id || INITIAL_EVENT.id) === activeEvent.id);
  const eventDecorItems = decorItems.filter((d) => (d.event_id || INITIAL_EVENT.id) === activeEvent.id);
  const eventTools = tools.filter((t) => (t.event_id || INITIAL_EVENT.id) === activeEvent.id);
  const eventShotlists = shotlists.filter((s) => (s.event_id || INITIAL_EVENT.id) === activeEvent.id);
  const eventPddReferences = pddReferences.filter((r) => (r.event_id || INITIAL_EVENT.id) === activeEvent.id);

  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {activeEvent.id &&
        canManageEventRoster(
          currentUser,
          roster,
          activeEvent.id,
          activeEvent.event_leader_id
        ) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-2.5">
            <div className="text-xs text-indigo-900">
              <span className="font-bold">Roster Anggota Divisi</span>{" "}
              <span className="text-indigo-700">
                — Tambahkan atau kelola anggota tim pelayanan untuk event ini.
              </span>
            </div>
            <Link
              href={`/events/${activeEvent.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Kelola Anggota Divisi (Roster)</span>
            </Link>
          </div>
        )}

      {/* Section Filter Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        {sectionTabs.map((sec) => {
          const tabMode = getSectionAccessMode(currentUser, activeEvent, roster, sec);
          return (
            <button
              key={sec}
              type="button"
              onClick={() => setActiveSection(sec)}
              className={`py-2 text-[11px] sm:text-xs font-bold rounded-xl transition truncate px-1 inline-flex items-center justify-center gap-1 ${
                activeSection === sec
                  ? "bg-white text-indigo-700 shadow-xs"
                  : tabMode === "LOCKED"
                  ? "text-slate-400 opacity-70"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tabMode === "LOCKED" && <Lock className="w-3 h-3 shrink-0" />}
              <span className="truncate">{sec}</span>
            </button>
          );
        })}
      </div>

      {/* RBAC Monitoring Banner for Ketua / Wakil / Event Leader */}
      {accessMode === "MONITOR" && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-2.5 text-xs text-indigo-800">
          <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Mode Monitoring (Read-Only):</strong> Anda memantau section ini sebagai Ketua / Wakil Leader. Aksi perubahan data dinonaktifkan.
          </span>
        </div>
      )}

      {/* RBAC Locked Card */}
      {accessMode === "LOCKED" ? (
        <Card className="p-8 text-center space-y-2.5 border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Akses Section Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Menu &amp; tools section ini hanya dapat dibuka oleh Leader atau Member yang ditugaskan pada section terkait.
          </p>
        </Card>
      ) : (
        <div key={`${activeSection}-${activeEvent.id}`} className="animate-tab-enter">
          {/* 1. SECTION ACARA: RUNDOWN BUILDER & SMART CUE CARDS */}
          {activeSection === "ACARA" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setAcaraSubTab("RUNDOWN")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    acaraSubTab === "RUNDOWN"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Rundown Builder</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAcaraSubTab("CUE_CARDS")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    acaraSubTab === "CUE_CARDS"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Smart Digital Cue Cards</span>
                </button>
              </div>

              <div key={acaraSubTab} className="animate-tab-enter">
              {acaraSubTab === "RUNDOWN" ? (
                <RundownBuilderView
                  items={items}
                  users={users}
                  onUpdateItems={onUpdateItems}
                  isLocked={!canEdit || isRundownLocked}
                />
              ) : (
                <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>Smart Digital Cue Cards</span>
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="purple" className="text-[10px]">
                    {eventGuides.length} Petunjuk
                  </Badge>
                  <Link href="/cue-cards">
                    <Button size="sm" variant="outline" className="text-xs font-bold gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                      <Presentation className="w-3.5 h-3.5" />
                      <span>Mode Layar MC</span>
                    </Button>
                  </Link>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setIsCueModalOpen(true)}
                      className="text-xs font-bold gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cue Card</span>
                    </Button>
                  )}
                </div>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventGuides.map((guide) => {
              const safeGuideImage = sanitizeHttpUrl(guide.layout_image_url);
              return (
              <Card key={guide.id} glow="purple" className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="purple" className="text-[10px]">
                    {guide.category}
                  </Badge>
                  <span className="text-[11px] text-slate-400">Dibaca seluruh tim</span>
                </div>

                <h4 className="text-sm sm:text-base font-extrabold text-slate-900">{guide.title}</h4>

                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  {guide.instructions_markdown}
                </div>

                {safeGuideImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoomImage({ url: safeGuideImage, title: guide.title });
                      setZoomLevel(1);
                    }}
                    className="w-full rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-300 transition relative group text-left"
                  >
                    <img
                      src={safeGuideImage}
                      alt={guide.title}
                      className="w-full h-36 object-cover"
                    />
                    <span className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-lg bg-slate-900/75 text-[10px] font-semibold text-white">
                      Tap untuk Zoom
                    </span>
                  </button>
                )}
              </Card>
            );})}
          </div>
                </div>
              )}
              </div>
        </div>
      )}

      {/* 2. SECTION DEKORASI: THEME & BUDGET */}
      {activeSection === "DEKORASI" && (
        <div className="space-y-4">
          <Card className="p-5 space-y-2 border-pink-200 bg-pink-50/40">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-pink-700">
              Konsep Utama Dekorasi Natal 2026
            </h4>
            <div className="text-base font-extrabold text-slate-900">
              Tema: &ldquo;Winter Warmth &amp; Golden Radiance&rdquo;
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kombinasi warna: Emerald Pine Green, Champagne Gold, dan Warm White fairy lights. Pohon natal utama 4 meter di sisi kanan mimbar dengan ornamen bintang akrilik transparan.
            </p>
          </Card>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-pink-700">
                Status Instalasi Dekorasi
              </h3>
              <Badge variant="pink" className="text-[10px]">
                {eventDecorItems.filter((d) => d.installation_status === "INSTALLED" || d.installation_status === "READY").length}/{eventDecorItems.length} Siap
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eventDecorItems.map((decor) => (
                <Card key={decor.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{decor.item_name}</div>
                    {decor.notes && <div className="text-xs text-slate-500 mt-0.5">{decor.notes}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCycleDecorStatus(decor.id)}
                    className="shrink-0"
                    title="Tap untuk ubah status"
                  >
                    <Badge
                      variant={
                        decor.installation_status === "INSTALLED" || decor.installation_status === "READY"
                          ? "emerald"
                          : decor.installation_status === "IN_PROGRESS"
                          ? "cyan"
                          : "amber"
                      }
                      className="text-[10px] cursor-pointer"
                    >
                      {decor.installation_status}
                    </Badge>
                  </button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. SECTION PERLENGKAPAN: INVENTORY CHECKLIST */}
      {activeSection === "PERLENGKAPAN" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
              <Wrench className="w-4 h-4" />
              <span>Checklist Kesiapan Alat Hari H</span>
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="orange" className="text-[10px]">
                {eventTools.filter((t) => t.is_ready).length}/{eventTools.length} Siap
              </Badge>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsToolModalOpen(true)}
                  className="text-xs font-bold gap-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Alat</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eventTools.map((tool) => (
              <Card
                key={tool.id}
                glow={tool.is_ready ? "emerald" : "amber"}
                className="cursor-pointer select-none"
                onClick={() => toggleToolReady(tool.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 ${tool.is_ready ? "text-emerald-600" : "text-slate-300"}`}>
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{tool.tool_name}</div>
                      {tool.notes && <div className="text-xs text-slate-500 mt-0.5">{tool.notes}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="neutral" className="text-[10px]">
                          Qty: {tool.quantity}
                        </Badge>
                        <Badge variant={tool.source === "RENTAL" ? "amber" : "cyan"} className="text-[10px]">
                          {tool.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge variant={tool.is_ready ? "emerald" : "amber"} className="text-[10px] shrink-0">
                    {tool.is_ready ? "READY" : "BELUM"}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 4. SECTION PDD: SHOTLIST & DRIVE */}
      {activeSection === "PDD" && (
        <div className="space-y-4">
          <Card glow="cyan" className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <Video className="w-4 h-4" />
                <span>Google Drive Reference Manager</span>
              </h4>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsDriveRefModalOpen(true)}
                  className="text-xs font-bold gap-1 border-sky-200 text-sky-700 hover:bg-sky-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Link Drive Fase</span>
                </Button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(["ALL", "PRE_EVENT", "EVENT_DAY", "POST_EVENT"] as const).map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => setPddPhaseFilter(ph)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition ${
                    pddPhaseFilter === ph
                      ? "bg-sky-50 border-sky-300 text-sky-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {ph === "ALL" ? "Semua Fase" : ph.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {eventPddReferences
                .filter((r) => pddPhaseFilter === "ALL" || r.phase === pddPhaseFilter)
                .map((refItem) => {
                  const safeRefUrl = sanitizeHttpUrl(refItem.url) || "#";
                  return (
                  <a
                    key={refItem.id}
                    href={safeRefUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition"
                  >
                    <div className="min-w-0">
                      <Badge variant="sky" className="text-[10px] mb-1">
                        {refItem.phase.replace("_", " ")}
                      </Badge>
                      <div className="text-xs font-bold text-slate-900 truncate">{refItem.title}</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-sky-600 shrink-0" />
                  </a>
                );})}
            </div>
          </Card>

          <div className="flex items-center justify-between pt-1">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sky-700">
              Shotlist Momen Kunci Video &amp; Foto
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="sky" className="text-[10px]">
                {eventShotlists.length} Scene
              </Badge>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsShotModalOpen(true)}
                  className="text-xs font-bold gap-1 border-sky-200 text-sky-700 hover:bg-sky-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Shotlist</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eventShotlists.map((shot) => (
              <Card key={shot.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant={shot.shot_type === "VIDEO" ? "crimson" : "sky"} className="text-[10px]">
                    {shot.shot_type}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleCycleShotStatus(shot.id)}
                    title="Tap untuk ubah status"
                  >
                    <Badge
                      variant={
                        shot.status === "EDITED"
                          ? "emerald"
                          : shot.status === "TAKEN"
                          ? "cyan"
                          : "neutral"
                      }
                      className="text-[10px] cursor-pointer"
                    >
                      {shot.status}
                    </Badge>
                  </button>
                </div>
                <div className="text-sm font-bold text-slate-900">{shot.scene_title}</div>
                {shot.camera_angle && (
                  <div className="text-xs text-slate-500 italic">Angle: {shot.camera_angle}</div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
        </div>
      )}

      {/* MODAL: TAMBAH LINK DRIVE FASE PDD (Single Clean Instance) */}
      <Modal
        isOpen={isDriveRefModalOpen}
        onClose={() => setIsDriveRefModalOpen(false)}
        title="Tambah Link Google Drive Fase"
        description="Simpan tautan folder Drive untuk fase Pre-Event, Event Day, atau Post-Event."
      >
        <div className="space-y-3">
          <select
            value={driveRefPhase}
            onChange={(e) => setDriveRefPhase(e.target.value as TaskPhase)}
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          >
            <option value="PRE_EVENT">PRE_EVENT</option>
            <option value="EVENT_DAY">EVENT_DAY</option>
            <option value="POST_EVENT">POST_EVENT</option>
          </select>
          <input
            type="text"
            value={driveRefTitle}
            onChange={(e) => setDriveRefTitle(e.target.value)}
            placeholder="Judul Folder (mis. Footage 4K Hari H)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <input
            type="url"
            value={driveRefUrl}
            onChange={(e) => setDriveRefUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDriveRefModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddDriveReference}>
              Simpan Link
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: TAMBAH CUE CARD */}
      <Modal
        isOpen={isCueModalOpen}
        onClose={() => setIsCueModalOpen(false)}
        title="Tambah Smart Digital Cue Card"
        description="Buat petunjuk teknis baru untuk tim Acara & seluruh section."
      >
        <div className="space-y-3">
          <input
            type="text"
            value={cueTitle}
            onChange={(e) => setCueTitle(e.target.value)}
            placeholder="Judul Cue Card (mis. Alur Altar Call)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={cueCategory}
            onChange={(e) => setCueCategory(e.target.value)}
            placeholder="Kategori (mis. STAGE_LAYOUT, CANDLE_LIGHT)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
          <textarea
            rows={3}
            value={cueInstructions}
            onChange={(e) => setCueInstructions(e.target.value)}
            placeholder="Instruksi teknis..."
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="url"
            value={cueImageUrl}
            onChange={(e) => setCueImageUrl(e.target.value)}
            placeholder="URL Gambar Layout Panggung (opsional)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCueModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddCueCard}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: ZOOMABLE STAGE LAYOUT */}
      <Modal
        isOpen={!!zoomImage}
        onClose={() => setZoomImage(null)}
        title={zoomImage?.title || "Layout Panggung"}
        description="Gunakan tombol zoom untuk melihat detail."
      >
        {zoomImage && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              {([1, 1.5, 2] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomLevel(z)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                    zoomLevel === z
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
            <div className="overflow-auto max-h-72 rounded-xl border border-slate-200 bg-slate-100">
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left" }}
                className="w-full transition-transform duration-200"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: CATAT BIAYA DEKORASI */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Catat Biaya Dekorasi"
        description="Tambahkan pengeluaran ke ledger sederhana."
      >
        <div className="space-y-3">
          <input
            type="text"
            value={budgetItemName}
            onChange={(e) => setBudgetItemName(e.target.value)}
            placeholder="Nama Item / Keperluan"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={budgetEst}
              onChange={(e) => setBudgetEst(e.target.value)}
              placeholder="Estimasi (Rp)"
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
            <input
              type="number"
              value={budgetAct}
              onChange={(e) => setBudgetAct(e.target.value)}
              placeholder="Aktual (Rp)"
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
          </div>
          <input
            type="url"
            value={budgetReceiptUrl}
            onChange={(e) => setBudgetReceiptUrl(e.target.value)}
            placeholder="URL Foto Nota / Kwitansi (opsional)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <input
            type="text"
            value={budgetNotes}
            onChange={(e) => setBudgetNotes(e.target.value)}
            placeholder="Catatan (opsional)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBudgetModalOpen(false)}>
              Batal
            </Button>
            <Button variant="emerald" size="sm" onClick={handleAddBudget}>
              Simpan Biaya
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: TAMBAH ALAT PERLENGKAPAN */}
      <Modal
        isOpen={isToolModalOpen}
        onClose={() => setIsToolModalOpen(false)}
        title="Tambah Alat Perlengkapan"
        description="Tambahkan item ke checklist kesiapan alat Hari H."
      >
        <div className="space-y-3">
          <input
            type="text"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder="Nama Alat (mis. Stand Mic)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              value={toolQty}
              onChange={(e) => setToolQty(Number(e.target.value) || 1)}
              placeholder="Qty"
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            />
            <select
              value={toolSource}
              onChange={(e) => setToolSource(e.target.value as "IN_HOUSE" | "RENTAL" | "PURCHASE")}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
            >
              <option value="IN_HOUSE">IN_HOUSE</option>
              <option value="RENTAL">RENTAL</option>
              <option value="PURCHASE">PURCHASE</option>
            </select>
          </div>
          <input
            type="text"
            value={toolNotes}
            onChange={(e) => setToolNotes(e.target.value)}
            placeholder="Catatan lokasi / PIC (opsional)"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsToolModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddTool}>
              Tambah Alat
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: TAMBAH SHOTLIST PDD */}
      <Modal
        isOpen={isShotModalOpen}
        onClose={() => setIsShotModalOpen(false)}
        title="Tambah Shotlist PDD"
        description="Tambahkan momen kunci foto/video untuk dokumentasi."
      >
        <div className="space-y-3">
          <input
            type="text"
            value={shotTitle}
            onChange={(e) => setShotTitle(e.target.value)}
            placeholder="Judul Scene / Momen"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <select
            value={shotType}
            onChange={(e) => setShotType(e.target.value as "PHOTO" | "VIDEO" | "REEL")}
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          >
            <option value="PHOTO">PHOTO</option>
            <option value="VIDEO">VIDEO</option>
            <option value="REEL">REEL</option>
          </select>
          <input
            type="text"
            value={shotAngle}
            onChange={(e) => setShotAngle(e.target.value)}
            placeholder="Camera Angle / Referensi"
            className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsShotModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddShotlist}>
              Simpan Shotlist
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
