"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  HeartPulse,
  KeyRound,
  LogOut,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  Unlock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/providers/auth-provider";
import type { OperationRecord, User, UserBaseRole } from "@/types/domain";

interface HealthInfo {
  connected: boolean;
  mode: string;
  latencyMs: number;
  keepAliveEndpoint: string;
  checkedAt: string;
}

interface TableCountRow {
  table: string;
  count: number;
}

const EMERGENCY_ROLES: { value: UserBaseRole; label: string }[] = [
  { value: "CREATIVE_LEADER", label: "Creative Leader" },
  { value: "WAKIL_LEADER", label: "Wakil Leader" },
  { value: "SEKRETARIS", label: "Sekretaris" },
  { value: "BENDAHARA", label: "Bendahara" },
  { value: "SECTION_LEADER", label: "Section Leader" },
  { value: "MEMBER", label: "Member / Anggota" },
];

export function SuperadminMaintenanceView() {
  const router = useRouter();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [tableCounts, setTableCounts] = useState<TableCountRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<OperationRecord[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [pinTarget, setPinTarget] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState("");

  const showNotice = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/maintenance", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotice("error", data.error || "Gagal memuat diagnostik Superadmin.");
      } else {
        setHealth(data.health);
        setTableCounts(data.tableCounts ?? []);
        setUsers(data.users ?? []);
        setLogs(data.logs ?? []);
      }
    } catch {
      showNotice("error", "Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  const runAction = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotice("error", data.error || "Operasi maintenance gagal.");
      } else {
        showNotice("success", data.message || "Operasi berhasil dijalankan.");
        await loadDiagnostics();
      }
    } catch {
      showNotice("error", "Gagal terhubung ke server.");
    } finally {
      setBusy(false);
    }
  };

  const handleEmergencyPinReset = async () => {
    if (!pinTarget || !/^\d{4}$/.test(pinValue)) return;
    await runAction({
      action: "EMERGENCY_RESET_PIN",
      user_id: pinTarget.id,
      new_pin: pinValue,
    });
    setPinTarget(null);
    setPinValue("");
  };

  const handleClearBrowserCache = () => {
    try {
      const keepUser = localStorage.getItem("CT_CURRENT_USER");
      localStorage.clear();
      if (keepUser) localStorage.setItem("CT_CURRENT_USER", keepUser);
      showNotice("success", "Cache lokal browser (Events, Roster, Draft) berhasil dibersihkan.");
    } catch {
      showNotice("error", "Gagal membersihkan cache lokal browser.");
    }
  };

  const operationalAccounts = users.filter((u) => !u.is_superadmin);
  const lockedAccounts = users.filter(
    (u) => u.locked_until && new Date(u.locked_until).getTime() > Date.now()
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span>Workspace</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              <span>Superadmin Server &amp; Web Maintenance</span>
            </h1>
            <p className="text-xs text-slate-500">
              Konsol teknis terisolasi untuk diagnostik database, audit trail, pemulihan akun Creative Leader, &amp; kebersihan data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={loading}
            onClick={() => loadDiagnostics()}
            className="gap-1.5 font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Run Diagnostics</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              router.replace("/superadmin/login");
              router.refresh();
            }}
            className="gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50 font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. System Health & Database Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-slate-200 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
            <span>Status Koneksi Database</span>
          </div>
          <div className="text-lg font-black text-slate-900">
            {health?.connected ? "Connected (Live)" : health?.mode || "Checking..."}
          </div>
          <p className="text-xs text-slate-500">
            Latency Query: <strong className="font-mono text-indigo-600">{health?.latencyMs ?? 0} ms</strong>
          </p>
        </Card>

        <Card className="p-4 border-slate-200 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-600" />
            <span>Keep-Alive &amp; Akun Teknis</span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono truncate">
            {health?.keepAliveEndpoint || "/api/health/keep-alive"}
          </div>
          <p className="text-xs text-slate-500">
            Akun Terkunci (Lockout): <strong className={lockedAccounts.length > 0 ? "text-rose-600" : "text-emerald-600"}>{lockedAccounts.length} akun</strong>
          </p>
        </Card>

        <Card className="p-4 border-slate-200 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-600" />
            <span>Total Rekaman Audit</span>
          </div>
          <div className="text-lg font-black text-slate-900">{logs.length} entri terbaru</div>
          <p className="text-xs text-slate-500">
            Diperiksa: {health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString("id-ID") : "-"}
          </p>
        </Card>
      </div>

      {/* Table Row Integrity Grid */}
      <Card className="p-5 border-slate-200 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <span>Pemeriksaan Integritas &amp; Jumlah Record Tabel Supabase</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {tableCounts.map((row) => (
            <div
              key={row.table}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between"
            >
              <span className="text-[11px] font-mono text-slate-600 truncate">{row.table}</span>
              <span className={`text-base font-black mt-1 ${row.count < 0 ? "text-rose-600" : "text-slate-900"}`}>
                {row.count < 0 ? "Error / Missing" : `${row.count} baris`}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 2. Emergency Account & Creative Leader Recovery */}
      <Card className="p-5 border-slate-200 space-y-3.5">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-amber-600" />
            <span>Emergency Account &amp; Creative Leader Recovery</span>
          </h2>
          <p className="text-xs text-slate-500">
            Reset PIN darurat, buka kunci akun terkunci, atau pulihkan jabatan Creative Leader apabila tim kehilangan akses pimpinan.
          </p>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {operationalAccounts.map((acc) => {
            const isLocked =
              acc.locked_until && new Date(acc.locked_until).getTime() > Date.now();
            return (
              <div
                key={acc.id}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-slate-900 truncate">
                      {acc.full_name}
                    </span>
                    <Badge variant="purple" className="text-[10px]">
                      {acc.base_role}
                    </Badge>
                    {isLocked && (
                      <Badge variant="crimson" className="text-[10px]">
                        Terkunci ({acc.failed_pin_attempts}x salah)
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {acc.phone || "-"} {acc.email ? `• ${acc.email}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <select
                    disabled={busy}
                    value={acc.base_role}
                    onChange={(e) =>
                      void runAction({
                        action: "EMERGENCY_SET_ROLE",
                        user_id: acc.id,
                        base_role: e.target.value,
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    {EMERGENCY_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setPinTarget(acc);
                      setPinValue("");
                    }}
                    className="text-xs gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset PIN Darurat</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Data Hygiene & Cache Tools */}
      <Card className="p-5 border-slate-200 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>Data Hygiene &amp; Session Cache Tools</span>
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void runAction({ action: "PURGE_OLD_NOTIFICATIONS", days: 30 })}
            className="text-xs font-semibold gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Bersihkan Notifikasi &gt; 30 Hari</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void runAction({ action: "PURGE_OLD_AUDIT_LOGS", days: 90 })}
            className="text-xs font-semibold gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Bersihkan Log Audit &gt; 90 Hari</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClearBrowserCache}
            className="text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Bersihkan Cache Lokal Browser</span>
          </Button>
        </div>
      </Card>

      {/* 4. System Audit Trail */}
      <Card className="p-5 border-slate-200 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>System Audit Trail (operation_records)</span>
        </h2>
        {logs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Belum ada catatan aktivitas sistem.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {logs.map((log) => (
              <div
                key={log.operation_id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="purple" className="text-[10px]">
                      {log.action_type}
                    </Badge>
                    <span className="text-xs font-bold text-slate-800">
                      {log.actor?.full_name || "Sistem"}
                    </span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-[11px] text-slate-600 break-all">
                      {JSON.stringify(log.details)}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {new Date(log.created_at).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reset PIN Darurat Modal */}
      <Modal
        isOpen={Boolean(pinTarget)}
        onClose={() => setPinTarget(null)}
        title="Reset PIN Darurat (Superadmin)"
        description={
          pinTarget
            ? `Tetapkan 4 digit PIN baru & buka lockout akun untuk ${pinTarget.full_name}`
            : ""
        }
      >
        <div className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.5em]"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPinTarget(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pinValue.length !== 4 || busy}
              onClick={handleEmergencyPinReset}
            >
              Terapkan Reset PIN
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
