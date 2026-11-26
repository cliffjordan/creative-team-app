"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BriefSectionScope,
  Event,
  EventBudgetLedgerItem,
  EventCommitteeMember,
  EventMinisterRow,
  EventRosterMember,
  RundownItem,
  TechnicalExecutionSection,
  TimelineTask,
  User,
} from "@/types/domain";
import {
  INITIAL_EVENT,
  canUserInitiateBrief,
  getProposalAccessMode,
  getUserEventRosterEntry,
  isCreativeLeader,
  isUserEventLeader,
} from "@/lib/mock-db";
import {
  EventProjectBriefData,
  createDefaultBriefForEvent,
  exportProjectBriefToPdf,
  formatDocumentGroupItems,
  mergeSyncedEventDataIntoBrief,
  resolveAcaraSections,
  resolveAtmosphereItems,
  resolveDecorSections,
  resolveFinalDirectionItems,
  resolveJourneySections,
  resolveOverviewSections,
  resolvePddSections,
  resolveTechRequirementItems,
  resolveTechnicalSections,
} from "@/lib/proposal/export-proposal-word";
import { AnimatedCollapse } from "@/components/motion/animated-primitives";
import { SPRING_TAB } from "@/providers/motion-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchWithTimeout, formatCurrencyIDR } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

interface ProposalBuilderViewProps {
  activeEvent?: Event;
  items?: RundownItem[];
  currentUser?: User | null;
  roster?: EventRosterMember[];
  onTasksGenerated?: (newTasks: TimelineTask[]) => void;
}

type DocSectionTab =
  | "COVER_OVERVIEW"
  | "ACARA_DEKORASI"
  | "PERLENGKAPAN_PDD"
  | "BUDGET_SEKRETARIAT"
  | "RUNDOWN_APPROVAL";

const TAB_SCOPED_KEYS: Record<DocSectionTab, Array<keyof EventProjectBriefData>> = {
  COVER_OVERVIEW: [
    "eventName",
    "mainTheme",
    "scriptureRef",
    "scriptureQuote",
    "eventDate",
    "eventTime",
    "location",
    "tagline",
    "background",
    "keyMessage",
    "objectives",
    "targetAudience",
    "coreConcept",
    "overviewSections",
    "desiredAtmosphere",
    "atmosphereItems",
    "journeyBefore",
    "journeyArrival",
    "journeyOpening",
    "journeyMain",
    "journeyClosing",
    "journeyAfter",
    "journeySections",
  ],
  ACARA_DEKORASI: [
    "acaraConcept",
    "acaraProgram",
    "acaraSpecialMoment",
    "acaraTalent",
    "acaraDuration",
    "acaraSpecialReq",
    "acaraSections",
    "decorConcept",
    "decorStyle",
    "decorPalette",
    "decorKeyVisual",
    "decorAreas",
    "decorSpecialReq",
    "decorImageUrl",
    "decorItems",
    "decorSections",
  ],
  PERLENGKAPAN_PDD: [
    "equipmentItems",
    "techRequirements",
    "techRequirementItems",
    "docObjective",
    "docContent",
    "docShotlist",
    "docPlatforms",
    "docTarget",
    "pddSections",
  ],
  BUDGET_SEKRETARIAT: [
    "budgetOverview",
    "budgetDetails",
    "orgChartUrl",
    "committee",
    "ministers",
  ],
  RUNDOWN_APPROVAL: [
    "rundownTotalDuration",
    "rundownOpenGate",
    "rundownStartTime",
    "rundownEndTime",
    "rundown",
    "techEvent1",
    "techEvent2",
    "techEvent3",
    "techSpecial1",
    "techSpecial2",
    "techSpecial3",
    "techPerf1",
    "techPerf2",
    "techPerf3",
    "technicalSections",
    "approvals",
    "finalCreativeDirection",
    "finalDirectionItems",
  ],
};

function DynamicBriefGroupsEditor({
  title,
  subtitle,
  groups,
  onChange,
  addGroupLabel = "Tambah Sub-Bagian",
  defaultNewTitle,
  idPrefix = "grp",
  pointPlaceholder,
}: {
  title: string;
  subtitle?: string;
  groups: TechnicalExecutionSection[];
  onChange: (nextGroups: TechnicalExecutionSection[]) => void;
  addGroupLabel?: string;
  defaultNewTitle: (nextIdx: number) => string;
  idPrefix?: string;
  pointPlaceholder?: (idx: number) => string;
}) {
  return (
    <Card className="p-5 space-y-4 border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...groups,
              {
                id: `${idPrefix}-${Date.now()}`,
                title: defaultNewTitle(groups.length + 1),
                items: [""],
              },
            ])
          }
          className="text-xs font-bold gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{addGroupLabel}</span>
        </Button>
      </div>

      <div className="space-y-3.5">
        <AnimatePresence initial={false}>
          {groups.map((group, gIdx) => (
            <AnimatedCollapse
              key={group.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={group.title}
                  onChange={(e) =>
                    onChange(
                      groups.map((g, idx) =>
                        idx === gIdx ? { ...g, title: e.target.value } : g
                      )
                    )
                  }
                  placeholder={defaultNewTitle(gIdx + 1)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onChange(
                      groups.map((g, idx) =>
                        idx === gIdx ? { ...g, items: [...g.items, ""] } : g
                      )
                    )
                  }
                  className="text-[11px] gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Poin</span>
                </Button>
                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(groups.filter((_, idx) => idx !== gIdx))}
                    title="Hapus Sub-Bagian"
                    className="p-1.5 rounded-xl border border-slate-200 bg-white text-rose-500 hover:bg-rose-50 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5 pl-1">
                <AnimatePresence initial={false}>
                  {(group.items.length > 0 ? group.items : [""]).map((point, pIdx) => (
                    <AnimatedCollapse key={`${group.id}-pt-${pIdx}`} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 w-5 text-right shrink-0">
                        {pIdx + 1}.
                      </span>
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => {
                          const baseItems = group.items.length > 0 ? group.items : [""];
                          onChange(
                            groups.map((g, idx) =>
                              idx === gIdx
                                ? {
                                    ...g,
                                    items: baseItems.map((it, i) =>
                                      i === pIdx ? e.target.value : it
                                    ),
                                  }
                                : g
                            )
                          );
                        }}
                        placeholder={
                          pointPlaceholder ? pointPlaceholder(pIdx + 1) : `Poin ${pIdx + 1}...`
                        }
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                      />
                      {(group.items.length > 1 || (group.items.length === 1 && pIdx > 0)) && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange(
                              groups.map((g, idx) =>
                                idx === gIdx
                                  ? {
                                      ...g,
                                      items: g.items.filter((_, i) => i !== pIdx),
                                    }
                                  : g
                              )
                            )
                          }
                          title="Hapus poin"
                          className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </AnimatedCollapse>
                  ))}
                </AnimatePresence>
              </div>
            </AnimatedCollapse>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function DynamicPointListEditor({
  title,
  subtitle,
  items,
  onChange,
  addLabel = "Poin",
  placeholderPrefix = "Poin",
}: {
  title: string;
  subtitle?: string;
  items: string[];
  onChange: (nextItems: string[]) => void;
  addLabel?: string;
  placeholderPrefix?: string;
}) {
  const safeItems = items.length > 0 ? items : [""];
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-extrabold text-slate-800">{title}</div>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...safeItems, ""])}
          className="text-[11px] gap-1"
        >
          <Plus className="w-3 h-3" />
          <span>{addLabel}</span>
        </Button>
      </div>
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {safeItems.map((pt, idx) => (
            <AnimatedCollapse key={`pt-${idx}`} className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 w-5 text-right shrink-0">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={pt}
                onChange={(e) =>
                  onChange(safeItems.map((old, i) => (i === idx ? e.target.value : old)))
                }
                placeholder={`${placeholderPrefix} ${idx + 1}...`}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
              />
              {safeItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(safeItems.filter((_, i) => i !== idx))}
                  title="Hapus poin"
                  className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </AnimatedCollapse>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ProposalBuilderView({
  activeEvent = INITIAL_EVENT,
  items = [],
  currentUser = null,
  roster = [],
  onTasksGenerated,
}: ProposalBuilderViewProps) {
  const accessMode = getProposalAccessMode(currentUser);
  const canInitiate = canUserInitiateBrief(currentUser, activeEvent, roster);
  const storageKey = `CT_EVENT_BRIEF_V2_${activeEvent.id}`;

  const isFullBriefManager =
    isCreativeLeader(currentUser) ||
    currentUser?.base_role === "WAKIL_LEADER" ||
    isUserEventLeader(currentUser, activeEvent, roster);
  const rosterEntry = getUserEventRosterEntry(currentUser, activeEvent.id, roster);
  const assignedSection = rosterEntry?.section;
  const isSekretaris = currentUser?.base_role === "SEKRETARIS";
  const isBendahara = currentUser?.base_role === "BENDAHARA";

  const showOverview = isFullBriefManager || isSekretaris;
  const showAcara = isFullBriefManager || assignedSection === "ACARA" || assignedSection === "ALL";
  const showDekorasi = isFullBriefManager || assignedSection === "DEKORASI" || assignedSection === "ALL";
  const showPerlengkapan = isFullBriefManager || assignedSection === "PERLENGKAPAN" || assignedSection === "ALL";
  const showPdd = isFullBriefManager || assignedSection === "PDD" || assignedSection === "ALL";
  const showBudget = isFullBriefManager || isBendahara;
  const showSecretariatSections = isFullBriefManager || isSekretaris;
  const showRundown = isFullBriefManager || assignedSection === "ACARA" || assignedSection === "ALL";
  const showTechnical =
    isFullBriefManager ||
    isSekretaris ||
    assignedSection === "ACARA" ||
    assignedSection === "DEKORASI" ||
    assignedSection === "PERLENGKAPAN" ||
    assignedSection === "PDD" ||
    assignedSection === "ALL";
  const showApproval = isFullBriefManager || isSekretaris;

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ id: DocSectionTab; label: string }> = [];
    if (showOverview) {
      tabs.push({ id: "COVER_OVERVIEW", label: "Sampul & 01–02 Overview" });
    }
    if (showAcara || showDekorasi) {
      const label =
        showAcara && showDekorasi
          ? "03A–03B Acara & Dekorasi"
          : showAcara
          ? "03A Section Acara"
          : "03B Section Dekorasi";
      tabs.push({ id: "ACARA_DEKORASI", label });
    }
    if (showPerlengkapan || showPdd) {
      const label =
        showPerlengkapan && showPdd
          ? "03C–03D Perlengkapan & PDD"
          : showPerlengkapan
          ? "03C Section Perlengkapan"
          : "03D Section PDD";
      tabs.push({ id: "PERLENGKAPAN_PDD", label });
    }
    if (showBudget || showSecretariatSections) {
      const label =
        showBudget && showSecretariatSections
          ? "04–06 Budget, Panitia & Pelayan"
          : showBudget
          ? "04 Pembiayaan (Bendahara)"
          : "05–06 Struktur Panitia & Pelayan";
      tabs.push({ id: "BUDGET_SEKRETARIAT", label });
    }
    if (showRundown || showTechnical || showApproval) {
      const label =
        showRundown && showApproval
          ? "07–09 Rundown, Teknis & Approval"
          : showRundown
          ? "07–08 Rundown & Teknis"
          : showApproval
          ? "08–09 Teknis & Approval"
          : "08 Teknis Pelaksanaan";
      tabs.push({ id: "RUNDOWN_APPROVAL", label });
    }
    return tabs;
  }, [
    showOverview,
    showAcara,
    showDekorasi,
    showPerlengkapan,
    showPdd,
    showBudget,
    showSecretariatSections,
    showRundown,
    showTechnical,
    showApproval,
  ]);

  const [docExists, setDocExists] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [step, setStep] = useState<DocSectionTab>("COVER_OVERVIEW");
  const [data, setData] = useState<EventProjectBriefData>(() =>
    createDefaultBriefForEvent(activeEvent)
  );
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === step)) {
      setStep(visibleTabs[0].id);
    }
  }, [visibleTabs, step]);

  const initLockRef = useRef(false);
  const saveLockRef = useRef(false);
  const docxLockRef = useRef(false);

  const overviewSections = useMemo(() => resolveOverviewSections(data), [data]);
  const atmosphereItems = useMemo(() => resolveAtmosphereItems(data), [data]);
  const journeySections = useMemo(() => resolveJourneySections(data), [data]);
  const acaraSections = useMemo(() => resolveAcaraSections(data), [data]);
  const decorSections = useMemo(() => resolveDecorSections(data), [data]);
  const techRequirementItems = useMemo(() => resolveTechRequirementItems(data), [data]);
  const pddSections = useMemo(() => resolvePddSections(data), [data]);
  const technicalSections = useMemo(() => resolveTechnicalSections(data), [data]);
  const finalDirectionItems = useMemo(() => resolveFinalDirectionItems(data), [data]);

  const updateOverviewSections = (nextGroups: TechnicalExecutionSection[]) => {
    const findVal = (id: string, fallbackIdx: number, prevVal: string) => {
      const grp = nextGroups.find((g) => g.id === id) ?? nextGroups[fallbackIdx];
      return grp ? formatDocumentGroupItems(grp.items) : prevVal;
    };
    setData((prev) => ({
      ...prev,
      overviewSections: nextGroups,
      tagline: findVal("ov-tagline", 2, prev.tagline),
      background: findVal("ov-background", 3, prev.background),
      keyMessage: findVal("ov-keymsg", 4, prev.keyMessage),
      objectives: findVal("ov-objectives", 5, prev.objectives),
      targetAudience: findVal("ov-audience", 6, prev.targetAudience),
      coreConcept: findVal("ov-concept", 7, prev.coreConcept),
    }));
  };

  const updateAtmosphereItems = (nextItems: string[]) => {
    setData((prev) => ({
      ...prev,
      atmosphereItems: nextItems,
      desiredAtmosphere: formatDocumentGroupItems(nextItems),
    }));
  };

  const updateJourneySections = (nextGroups: TechnicalExecutionSection[]) => {
    setData((prev) => ({
      ...prev,
      journeySections: nextGroups,
      journeyBefore: formatDocumentGroupItems(nextGroups[0]?.items ?? [prev.journeyBefore]),
      journeyArrival: formatDocumentGroupItems(nextGroups[1]?.items ?? [prev.journeyArrival]),
      journeyOpening: formatDocumentGroupItems(nextGroups[2]?.items ?? [prev.journeyOpening]),
      journeyMain: formatDocumentGroupItems(nextGroups[3]?.items ?? [prev.journeyMain]),
      journeyClosing: formatDocumentGroupItems(nextGroups[4]?.items ?? [prev.journeyClosing]),
      journeyAfter: formatDocumentGroupItems(nextGroups[5]?.items ?? [prev.journeyAfter]),
    }));
  };

  const updateAcaraSections = (nextGroups: TechnicalExecutionSection[]) => {
    setData((prev) => ({
      ...prev,
      acaraSections: nextGroups,
      acaraConcept: formatDocumentGroupItems(nextGroups[0]?.items ?? [prev.acaraConcept]),
      acaraProgram: formatDocumentGroupItems(nextGroups[1]?.items ?? [prev.acaraProgram]),
      acaraSpecialMoment: formatDocumentGroupItems(nextGroups[2]?.items ?? [prev.acaraSpecialMoment]),
      acaraTalent: formatDocumentGroupItems(nextGroups[3]?.items ?? [prev.acaraTalent]),
      acaraDuration: formatDocumentGroupItems(nextGroups[4]?.items ?? [prev.acaraDuration]),
      acaraSpecialReq: formatDocumentGroupItems(nextGroups[5]?.items ?? [prev.acaraSpecialReq]),
    }));
  };

  const updateDecorSections = (nextGroups: TechnicalExecutionSection[]) => {
    setData((prev) => ({
      ...prev,
      decorSections: nextGroups,
      decorConcept: formatDocumentGroupItems(nextGroups[0]?.items ?? [prev.decorConcept]),
      decorStyle: formatDocumentGroupItems(nextGroups[1]?.items ?? [prev.decorStyle]),
      decorPalette: formatDocumentGroupItems(nextGroups[2]?.items ?? [prev.decorPalette]),
      decorKeyVisual: formatDocumentGroupItems(nextGroups[3]?.items ?? [prev.decorKeyVisual]),
      decorAreas: formatDocumentGroupItems(nextGroups[4]?.items ?? [prev.decorAreas]),
      decorSpecialReq: formatDocumentGroupItems(nextGroups[5]?.items ?? [prev.decorSpecialReq]),
    }));
  };

  const updateTechRequirementItems = (nextItems: string[]) => {
    setData((prev) => ({
      ...prev,
      techRequirementItems: nextItems,
      techRequirements: formatDocumentGroupItems(nextItems),
    }));
  };

  const updatePddSections = (nextGroups: TechnicalExecutionSection[]) => {
    setData((prev) => ({
      ...prev,
      pddSections: nextGroups,
      docObjective: formatDocumentGroupItems(nextGroups[0]?.items ?? [prev.docObjective]),
      docContent: formatDocumentGroupItems(nextGroups[1]?.items ?? [prev.docContent]),
      docShotlist: formatDocumentGroupItems(nextGroups[2]?.items ?? [prev.docShotlist]),
      docPlatforms: formatDocumentGroupItems(nextGroups[3]?.items ?? [prev.docPlatforms]),
      docTarget: formatDocumentGroupItems(nextGroups[4]?.items ?? [prev.docTarget]),
    }));
  };

  const updateTechnicalSections = (nextGroups: TechnicalExecutionSection[]) => {
    const g0 = nextGroups[0]?.items ?? [];
    const g1 = nextGroups[1]?.items ?? [];
    const g2 = nextGroups[2]?.items ?? [];
    setData((prev) => ({
      ...prev,
      technicalSections: nextGroups,
      techEvent1: g0[0] ?? prev.techEvent1,
      techEvent2: g0[1] ?? prev.techEvent2,
      techEvent3: g0[2] ?? prev.techEvent3,
      techSpecial1: g1[0] ?? prev.techSpecial1,
      techSpecial2: g1[1] ?? prev.techSpecial2,
      techSpecial3: g1[2] ?? prev.techSpecial3,
      techPerf1: g2[0] ?? prev.techPerf1,
      techPerf2: g2[1] ?? prev.techPerf2,
      techPerf3: g2[2] ?? prev.techPerf3,
    }));
  };

  const updateFinalDirectionItems = (nextItems: string[]) => {
    setData((prev) => ({
      ...prev,
      finalDirectionItems: nextItems,
      finalCreativeDirection: formatDocumentGroupItems(nextItems),
    }));
  };

  const showToast = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4500);
  };

  const fetchLatestSyncedData = useCallback(
    async (baseData: EventProjectBriefData): Promise<EventProjectBriefData> => {
      let budgets: EventBudgetLedgerItem[] = [];
      let committee: EventCommitteeMember[] = [];
      let ministers: EventMinisterRow[] = [];

      // Local fallback first
      try {
        const rawB = localStorage.getItem("CT_SECTION_BUDGETS");
        if (rawB) {
          budgets = (JSON.parse(rawB) as EventBudgetLedgerItem[]).filter(
            (b) => b.event_id === activeEvent.id
          );
        }
        const rawC = localStorage.getItem(`CT_SECRETARIAT_COMMITTEE_${activeEvent.id}`);
        if (rawC) committee = JSON.parse(rawC) as EventCommitteeMember[];
        const rawM = localStorage.getItem(`CT_SECRETARIAT_MINISTERS_${activeEvent.id}`);
        if (rawM) ministers = JSON.parse(rawM) as EventMinisterRow[];
      } catch {}

      if (activeEvent.id) {
        try {
          const [bRes, sRes] = await Promise.all([
            fetch(`/api/events/${activeEvent.id}/budget`, { cache: "no-store" }),
            fetch(`/api/events/${activeEvent.id}/secretariat`, { cache: "no-store" }),
          ]);
          if (bRes.ok) {
            const bJson = await bRes.json();
            if (Array.isArray(bJson.items) && bJson.items.length > 0) {
              budgets = bJson.items as EventBudgetLedgerItem[];
            }
          }
          if (sRes.ok) {
            const sJson = await sRes.json();
            if (Array.isArray(sJson.committee) && sJson.committee.length > 0) {
              committee = sJson.committee as EventCommitteeMember[];
            }
            if (Array.isArray(sJson.ministers) && sJson.ministers.length > 0) {
              ministers = sJson.ministers as EventMinisterRow[];
            }
          }
        } catch {}
      }

      return mergeSyncedEventDataIntoBrief(baseData, {
        event: activeEvent,
        budgets,
        committee,
        ministers,
        rundownItems: items,
      });
    },
    [activeEvent, items]
  );

  // Load existing 1-doc-per-event from Supabase / localStorage
  useEffect(() => {
    if (!activeEvent.id) {
      setLoadingDoc(false);
      return;
    }

    let mounted = true;
    setLoadingDoc(true);

    async function loadDocument() {
      let initialBrief = createDefaultBriefForEvent(activeEvent);
      let foundExisting = false;

      try {
        const localSaved = localStorage.getItem(storageKey);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (parsed && parsed.exists && parsed.data) {
            foundExisting = true;
            initialBrief = { ...initialBrief, ...(parsed.data as EventProjectBriefData) };
          }
        }
      } catch {}

      try {
        const res = await fetch(`/api/events/${activeEvent.id}/document`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json?.exists && json?.document) {
            foundExisting = true;
            const remoteData = (json.document.document_data || {}) as Partial<EventProjectBriefData>;
            initialBrief = {
              ...initialBrief,
              ...remoteData,
              ...(json.document.org_chart_url
                ? { orgChartUrl: String(json.document.org_chart_url) }
                : {}),
            };
          }
        }
      } catch {}

      const merged = await fetchLatestSyncedData(initialBrief);
      if (!mounted) return;
      setDocExists(foundExisting);
      setData(merged);
      setLoadingDoc(false);
    }

    loadDocument();
    return () => {
      mounted = false;
    };
  }, [activeEvent, storageKey, fetchLatestSyncedData]);

  const persistLocal = (nextExists: boolean, nextData: EventProjectBriefData) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ exists: nextExists, data: nextData }));
    } catch {}
  };

  const handleInitiateDocument = async () => {
    if (!canInitiate || docExists || !activeEvent.id || initLockRef.current) return;
    initLockRef.current = true;
    setInitiating(true);
    try {
      const syncedInitial = await fetchLatestSyncedData(createDefaultBriefForEvent(activeEvent));
      const res = await fetchWithTimeout(
        `/api/events/${activeEvent.id}/document/init`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_data: syncedInitial,
            org_chart_url: syncedInitial.orgChartUrl || null,
          }),
        },
        15000
      );
      const json = await res.json();
      if (res.status === 409 && json?.document) {
        setDocExists(true);
        showToast("success", "Dokumen sudah pernah dibuat sebelumnya; memuat versi aktif.");
        return;
      }
      if (!res.ok || !json?.success) {
        showToast("error", json?.error || "Gagal menginisiasi dokumen event.");
        return;
      }

      setDocExists(true);
      setData(syncedInitial);
      persistLocal(true, syncedInitial);

      if (Array.isArray(json.tasks) && json.tasks.length > 0) {
        onTasksGenerated?.(json.tasks as TimelineTask[]);
      }

      showToast(
        "success",
        "Dokumen Event Project Brief dibuat & 6 task otomatis ditugaskan ke Section Leader, Bendahara, dan Sekretaris!"
      );
    } catch {
      showToast("error", "Gagal terhubung ke server atau waktu permintaan habis.");
    } finally {
      initLockRef.current = false;
      setInitiating(false);
    }
  };

  const resolveScopeForSave = (): BriefSectionScope => {
    if (isFullBriefManager) return "FULL";
    if (assignedSection === "ACARA") return step === "RUNDOWN_APPROVAL" ? "TECHNICAL" : "ACARA";
    if (assignedSection === "DEKORASI") return step === "RUNDOWN_APPROVAL" ? "TECHNICAL" : "DEKORASI";
    if (assignedSection === "PERLENGKAPAN") return step === "RUNDOWN_APPROVAL" ? "TECHNICAL" : "PERLENGKAPAN";
    if (assignedSection === "PDD") return step === "RUNDOWN_APPROVAL" ? "TECHNICAL" : "PDD";
    if (isBendahara) return "BUDGET";
    if (isSekretaris) return "OVERVIEW";
    return "FULL";
  };

  const handleSaveDocument = async () => {
    if (!docExists || !activeEvent.id || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const scopedKeys = TAB_SCOPED_KEYS[step] ?? [];
      const scopedPayload: Record<string, unknown> = {};
      for (const k of scopedKeys) {
        scopedPayload[k as string] = data[k];
      }

      const res = await fetchWithTimeout(
        `/api/events/${activeEvent.id}/document`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_data: scopedPayload,
            org_chart_url: step === "BUDGET_SEKRETARIAT" ? data.orgChartUrl || null : undefined,
            section_scope: resolveScopeForSave(),
          }),
        },
        15000
      );
      const json = await res.json();
      persistLocal(true, data);
      if (!res.ok || !json?.success) {
        showToast("error", json?.error || "Disimpan di browser; gagal sinkron ke server.");
      } else {
        showToast("success", "Perubahan Dokumen Event Project Brief berhasil disimpan.");
      }
    } catch {
      persistLocal(true, data);
      showToast("error", "Koneksi gagal; draft disimpan sementara di browser.");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const handleSyncSources = async () => {
    const synced = await fetchLatestSyncedData(data);
    setData(synced);
    persistLocal(docExists, synced);
    showToast(
      "success",
      "Data terbaru dari Pembiayaan (Bendahara), Struktur Panitia & Pelayan (Sekretariat), dan Rundown berhasil ditarik."
    );
  };

  const handleDownloadDocx = async () => {
    if (docxLockRef.current) return;
    docxLockRef.current = true;
    setExportingDocx(true);
    try {
      const synced = await fetchLatestSyncedData(data);
      setData(synced);
      const res = await fetchWithTimeout(
        `/api/events/${activeEvent.id || "event"}/document/export-docx`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(synced),
        },
        25000
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Gagal menghasilkan dokumen Word (.docx)");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(synced.eventName || "Event-Project-Brief")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-|-$/g, "")}-Brief.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal mengunduh .docx");
    } finally {
      docxLockRef.current = false;
      setExportingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    const synced = await fetchLatestSyncedData(data);
    setData(synced);
    exportProjectBriefToPdf(synced);
  };

  if (accessMode === "LOCKED") {
    return (
      <Card className="p-8 text-center space-y-2.5 border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900">Akses Dokumen Dibatasi</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Menu Dokumen Event Project Brief hanya terbuka setelah Creative Leader menetapkan role atau divisi Anda.
        </p>
      </Card>
    );
  }

  if (loadingDoc) {
    return (
      <Card className="p-10 text-center text-xs text-slate-500 animate-pulse">
        Memuat status Dokumen Event Project Brief...
      </Card>
    );
  }

  // Case A: Single source per event_id — Not yet initiated
  if (!docExists) {
    return (
      <div className="space-y-4 pb-28 lg:pb-12 animate-fade-in">
        {notice && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
              notice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        <Card className="max-w-xl mx-auto p-7 sm:p-9 text-center space-y-4 border-slate-200 shadow-sm mt-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <Badge variant="purple" className="text-[10px]">
              1 DOKUMEN TUNGGAL PER EVENT
            </Badge>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Dokumen Project Brief Belum Diinisiasi
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Setiap event hanya memiliki satu dokumen resmi{" "}
              <strong>Event Project Brief ({activeEvent.title})</strong>. Saat dibuat, sistem
              otomatis menugaskan task pengisian bagian seksi kepada masing-masing Section Leader,
              Bendahara, dan Sekretaris.
            </p>
          </div>

          {canInitiate ? (
            <Button
              size="lg"
              variant="primary"
              disabled={initiating}
              onClick={handleInitiateDocument}
              className="w-full sm:w-auto px-6 font-bold gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {initiating
                  ? "Menginisiasi Dokumen & Task..."
                  : "Buat Dokumen Event Project Brief"}
              </span>
            </Button>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              Hanya <strong>Event Leader</strong>, <strong>Wakil Leader</strong>, atau{" "}
              <strong>Creative Leader</strong> yang berhak menginisiasi pembuatan dokumen awal.
            </div>
          )}
        </Card>
      </div>
    );
  }

  const totalOverviewBudget = data.budgetOverview.reduce(
    (s, b) => s + (Number(b.estimated) || 0),
    0
  );

  // Case B: Document exists — Edit-only mode + Dual Export (.docx & .pdf)
  return (
    <div className="space-y-5 pb-28 lg:pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Event Project Brief — {activeEvent.title}</span>
            </h2>
            <Badge variant="emerald" className="text-[10px]">
              Dokumen Aktif (Edit Mode)
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Template resmi 9 Bagian. Bagian Pembiayaan (04), Panitia (05), Pelayan (06), &amp; Rundown (07) tersinkron otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncSources}
            className="text-xs font-bold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sinkronkan Data</span>
          </Button>
          <Button
            size="sm"
            variant="emerald"
            disabled={saving}
            onClick={handleSaveDocument}
            className="text-xs font-bold gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={exportingDocx}
            onClick={handleDownloadDocx}
            className="text-xs font-bold gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingDocx ? "Menyiapkan..." : "Download Word (.docx)"}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            className="text-xs font-bold gap-1.5 border-slate-300 text-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Download PDF (.pdf)</span>
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Section Tabs (Filtered by Role & Section) */}
      <div data-lenis-prevent className="flex gap-1.5 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => {
          const active = step === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStep(tab.id)}
              className={`relative px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                active
                  ? "border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="brief-section-tab"
                  transition={SPRING_TAB}
                  className="absolute inset-0 rounded-[11px] bg-indigo-600 shadow-xs"
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: COVER + 01. OVERVIEW + 02. JOURNEY */}
      {step === "COVER_OVERVIEW" && showOverview && (
        <div className="space-y-4">
          <Card className="p-5 space-y-3.5 border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              Halaman Sampul (Cover Brief)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Acara &amp; Tahun</label>
                <input
                  type="text"
                  value={data.eventName}
                  onChange={(e) => setData({ ...data, eventName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Main Theme / Tema Utama</label>
                <input
                  type="text"
                  value={data.mainTheme}
                  onChange={(e) => setData({ ...data, mainTheme: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ayat Tema (Kitab Pasal:Ayat)</label>
                <input
                  type="text"
                  value={data.scriptureRef}
                  onChange={(e) => setData({ ...data, scriptureRef: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Jam Mulai &amp; Lokasi / Venue</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={data.eventTime}
                    onChange={(e) => setData({ ...data, eventTime: e.target.value })}
                    placeholder="16.00 WIB"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                  />
                  <input
                    type="text"
                    value={data.location}
                    onChange={(e) => setData({ ...data, location: e.target.value })}
                    placeholder="Venue"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Kutipan Ayat Alkitab</label>
                <input
                  type="text"
                  value={data.scriptureQuote}
                  onChange={(e) => setData({ ...data, scriptureQuote: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Pelaksanaan</label>
                <input
                  type="text"
                  value={data.eventDate}
                  onChange={(e) => setData({ ...data, eventDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm"
                />
              </div>
            </div>
          </Card>

          <DynamicBriefGroupsEditor
            title="01. Project Overview (Dinamis)"
            subtitle="Tambah sub-bagian atau poin penjelasan sesuai kebutuhan brief. Tersinkron ke Word (.docx) & PDF (.pdf)."
            groups={overviewSections}
            onChange={updateOverviewSections}
            defaultNewTitle={(n) => `Poin Overview ${n}`}
            idPrefix="ov-grp"
            pointPlaceholder={(idx) => `Isi poin overview ${idx}...`}
          />

          <Card className="p-5 space-y-4 border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              02. Event Experience &amp; Participant Journey (Dinamis)
            </h3>
            <DynamicPointListEditor
              title="Desired Atmosphere"
              subtitle="Tambahkan poin suasana / ambience acara yang ingin dibangun."
              items={atmosphereItems}
              onChange={updateAtmosphereItems}
              addLabel="Tambah Poin"
              placeholderPrefix="Suasana"
            />
            <DynamicBriefGroupsEditor
              title="Participant Journey (Per Tahap)"
              subtitle="Kelola fase pengalaman peserta secara fleksibel (tambah/hapus fase & poin)."
              groups={journeySections}
              onChange={updateJourneySections}
              addGroupLabel="Tambah Fase"
              defaultNewTitle={(n) => `Fase ${n}`}
              idPrefix="jrn-grp"
              pointPlaceholder={(idx) => `Pengalaman peserta poin ${idx}...`}
            />
          </Card>
        </div>
      )}

      {/* TAB 2: 03A ACARA & 03B DEKORASI */}
      {step === "ACARA_DEKORASI" && (showAcara || showDekorasi) && (
        <div className="space-y-4">
          {showAcara && (
            <DynamicBriefGroupsEditor
              title="03A. Section — Acara (Dinamis)"
              subtitle="Kelola sub-bagian & poin konsep acara secara dinamis ala Bagian 08."
              groups={acaraSections}
              onChange={updateAcaraSections}
              defaultNewTitle={(n) => `Sub-Bagian Acara ${n}`}
              idPrefix="acara-grp"
              pointPlaceholder={(idx) => `Detail acara poin ${idx}...`}
            />
          )}

          {showDekorasi && (
            <div className="space-y-4">
              <DynamicBriefGroupsEditor
                title="03B. Section — Konsep Dekorasi (Dinamis)"
                subtitle="Kelola konsep, gaya visual, palet warna, area dekorasi & poin detailnya."
                groups={decorSections}
                onChange={updateDecorSections}
                defaultNewTitle={(n) => `Aspek Dekorasi ${n}`}
                idPrefix="decor-grp"
                pointPlaceholder={(idx) => `Detail dekorasi poin ${idx}...`}
              />

              <Card className="p-5 space-y-3 border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    03B. Referensi Visual &amp; Daftar Kebutuhan Item Dekorasi
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setData({
                        ...data,
                        decorItems: [...data.decorItems, { name: "", qty: "1 Set", description: "" }],
                      })
                    }
                    className="text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Item Dekor
                  </Button>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Link Mockup / Referensi Dekorasi Panggung
                  </label>
                  <input
                    type="text"
                    value={data.decorImageUrl}
                    onChange={(e) => setData({ ...data, decorImageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold text-slate-700">Daftar Kebutuhan Item Dekorasi</div>
                  {data.decorItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Nama item dekorasi"
                        value={item.name}
                        onChange={(e) =>
                          setData({
                            ...data,
                            decorItems: data.decorItems.map((d, i) =>
                              i === idx ? { ...d, name: e.target.value } : d
                            ),
                          })
                        }
                        className="sm:col-span-4 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={(e) =>
                          setData({
                            ...data,
                            decorItems: data.decorItems.map((d, i) =>
                              i === idx ? { ...d, qty: e.target.value } : d
                            ),
                          })
                        }
                        className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Keterangan / Fungsi"
                        value={item.description}
                        onChange={(e) =>
                          setData({
                            ...data,
                            decorItems: data.decorItems.map((d, i) =>
                              i === idx ? { ...d, description: e.target.value } : d
                            ),
                          })
                        }
                        className="sm:col-span-5 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setData({
                            ...data,
                            decorItems: data.decorItems.filter((_, i) => i !== idx),
                          })
                        }
                        className="sm:col-span-1 p-2 rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50 flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 03C PERLENGKAPAN & 03D DOKUMENTASI */}
      {step === "PERLENGKAPAN_PDD" && (showPerlengkapan || showPdd) && (
        <div className="space-y-4">
          {showPerlengkapan && (
          <Card className="p-5 space-y-4 border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                03C. Section — Perlengkapan &amp; Teknis
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    equipmentItems: [
                      ...data.equipmentItems,
                      { name: "", qty: "1 Set", purpose: "", priority: "High" },
                    ],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Equipment
              </Button>
            </div>

            <div className="space-y-2">
              {data.equipmentItems.map((eq, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Nama peralatan"
                    value={eq.name}
                    onChange={(e) =>
                      setData({
                        ...data,
                        equipmentItems: data.equipmentItems.map((item, i) =>
                          i === idx ? { ...item, name: e.target.value } : item
                        ),
                      })
                    }
                    className="sm:col-span-4 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Qty"
                    value={eq.qty}
                    onChange={(e) =>
                      setData({
                        ...data,
                        equipmentItems: data.equipmentItems.map((item, i) =>
                          i === idx ? { ...item, qty: e.target.value } : item
                        ),
                      })
                    }
                    className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Kegunaan / Area"
                    value={eq.purpose}
                    onChange={(e) =>
                      setData({
                        ...data,
                        equipmentItems: data.equipmentItems.map((item, i) =>
                          i === idx ? { ...item, purpose: e.target.value } : item
                        ),
                      })
                    }
                    className="sm:col-span-3 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <select
                    value={eq.priority}
                    onChange={(e) =>
                      setData({
                        ...data,
                        equipmentItems: data.equipmentItems.map((item, i) =>
                          i === idx ? { ...item, priority: e.target.value } : item
                        ),
                      })
                    }
                    className="sm:col-span-2 rounded-xl border border-slate-200 px-2.5 py-2 text-xs"
                  >
                    <option value="High">High</option>
                    <option value="Med">Med</option>
                    <option value="Low">Low</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        equipmentItems: data.equipmentItems.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50 flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <DynamicPointListEditor
              title="Special Technical Requirements (Dinamis)"
              subtitle="Tambahkan catatan & syarat teknis perlengkapan (rehearsal H-1, kabel backup, HT, dll)."
              items={techRequirementItems}
              onChange={updateTechRequirementItems}
              addLabel="Tambah Catatan"
              placeholderPrefix="Syarat teknis"
            />
          </Card>
          )}

          {showPdd && (
            <DynamicBriefGroupsEditor
              title="03D. Section — Dokumentasi / PDD (Dinamis)"
              subtitle="Kelola objektif, konten, shot list prioritas, platform publikasi, dan target output secara dinamis."
              groups={pddSections}
              onChange={updatePddSections}
              defaultNewTitle={(n) => `Sub-Bagian PDD ${n}`}
              idPrefix="pdd-grp"
              pointPlaceholder={(idx) => `Detail PDD poin ${idx}...`}
            />
          )}
        </div>
      )}

      {/* TAB 4: 04 BUDGET + 05 PANITIA + 06 PELAYAN (AUTO-SYNCED) */}
      {step === "BUDGET_SEKRETARIAT" && (showBudget || showSecretariatSections) && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-xs text-indigo-800 flex flex-wrap items-center justify-between gap-2">
            <span>
              Bagian <strong>04 (Pembiayaan)</strong> ditarik dari menu <strong>Pembiayaan</strong>, sedangkan Bagian <strong>05 (Struktur Panitia)</strong> &amp; <strong>06 (Daftar Pelayan)</strong> ditarik dari menu <strong>Sekretariat</strong>.
            </span>
            <Button size="sm" variant="primary" onClick={handleSyncSources} className="text-xs gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tarik Data Terbaru</span>
            </Button>
          </div>

          {showBudget && (
          <Card className="p-5 space-y-3 border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">04. Budget Overview</h3>
              <span className="text-xs font-mono font-extrabold text-emerald-700">
                Total: {formatCurrencyIDR(totalOverviewBudget)}
              </span>
            </div>
            <div data-lenis-prevent className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-200 px-3 py-2 text-left">Kategori</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Estimasi</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Aktual</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.budgetOverview.map((b, i) => (
                    <tr key={i}>
                      <td className="border border-slate-200 px-3 py-1.5 font-semibold">{b.category}</td>
                      <td className="border border-slate-200 px-3 py-1.5 text-right font-mono">
                        {formatCurrencyIDR(b.estimated)}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 text-right font-mono">
                        {b.actual > 0 ? formatCurrencyIDR(b.actual) : "—"}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 text-center">{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          )}

          {showSecretariatSections && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3 border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900">
                05. Key People &amp; PIC (Struktur Panitia)
              </h3>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  URL Gambar Org Chart (Opsional)
                </label>
                <input
                  type="url"
                  value={data.orgChartUrl}
                  onChange={(e) => setData({ ...data, orgChartUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              {data.committee.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Belum ada data Struktur Panitia di menu Sekretariat.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.committee.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-slate-800">{c.role}</span>
                      <span className="text-slate-600 text-right">
                        {c.pic} {c.contact !== "-" ? `(${c.contact})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3 border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900">
                06. Daftar Pelayan Acara
              </h3>
              {data.ministers.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Belum ada data Struktur Pelayan di menu Sekretariat.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.ministers.map((m, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="font-bold text-slate-800">{m.role}</div>
                      <div className="text-slate-600 mt-0.5">{m.members}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          )}
        </div>
      )}

      {/* TAB 5: 07 RUNDOWN + 08 TEKNIS + 09 APPROVAL */}
      {step === "RUNDOWN_APPROVAL" && (showRundown || showTechnical || showApproval) && (
        <div className="space-y-4">
          {showRundown && (
          <Card className="p-5 space-y-3 border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              07. Susunan Acara (Rundown Ringkas)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Total Durasi</label>
                <input
                  type="text"
                  value={data.rundownTotalDuration}
                  onChange={(e) => setData({ ...data, rundownTotalDuration: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Jam Open Gate</label>
                <input
                  type="text"
                  value={data.rundownOpenGate}
                  onChange={(e) => setData({ ...data, rundownOpenGate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Jam Mulai</label>
                <input
                  type="text"
                  value={data.rundownStartTime}
                  onChange={(e) => setData({ ...data, rundownStartTime: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Jam Selesai</label>
                <input
                  type="text"
                  value={data.rundownEndTime}
                  onChange={(e) => setData({ ...data, rundownEndTime: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              Terhubung dengan <strong>{data.rundown.length} segmen rundown</strong> event aktif.
            </div>
          </Card>
          )}

          {showTechnical && (
            <DynamicBriefGroupsEditor
              title="08. Teknis Pelaksanaan (Dinamis)"
              subtitle="Tambah sub-bagian dan poin teknis sesuai kebutuhan event. Tersinkron penuh ke ekspor Word (.docx) dan PDF (.pdf)."
              groups={technicalSections}
              onChange={updateTechnicalSections}
              defaultNewTitle={(n) => `08.${n} Sub-Bagian Teknis Baru`}
              idPrefix="tech-group"
              pointPlaceholder={(idx) => `Poin teknis ${idx}...`}
            />
          )}

          {showApproval && (
          <Card className="p-5 space-y-4 border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                09. Approval &amp; Final Creative Direction
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setData({
                    ...data,
                    approvals: [...data.approvals, { role: "Penanggung Jawab Tambahan", name: "-", date: "" }],
                  })
                }
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Pengesahan
              </Button>
            </div>
            <div className="space-y-2">
              {data.approvals.map((app, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Role / Jabatan"
                    value={app.role}
                    onChange={(e) =>
                      setData({
                        ...data,
                        approvals: data.approvals.map((a, i) =>
                          i === idx ? { ...a, role: e.target.value } : a
                        ),
                      })
                    }
                    className="sm:col-span-5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Nama Lengkap"
                    value={app.name}
                    onChange={(e) =>
                      setData({
                        ...data,
                        approvals: data.approvals.map((a, i) =>
                          i === idx ? { ...a, name: e.target.value } : a
                        ),
                      })
                    }
                    className="sm:col-span-4 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Tanggal"
                    value={app.date}
                    onChange={(e) =>
                      setData({
                        ...data,
                        approvals: data.approvals.map((a, i) =>
                          i === idx ? { ...a, date: e.target.value } : a
                        ),
                      })
                    }
                    className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setData({
                        ...data,
                        approvals: data.approvals.filter((_, i) => i !== idx),
                      })
                    }
                    className="sm:col-span-1 p-2 rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50 flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <DynamicPointListEditor
              title="Final Creative Direction Statement (Dinamis)"
              subtitle="Poin-poin arahan kreatif final lintas seksi."
              items={finalDirectionItems}
              onChange={updateFinalDirectionItems}
              addLabel="Tambah Poin"
              placeholderPrefix="Arahan"
            />
          </Card>
          )}
        </div>
      )}
    </div>
  );
}
