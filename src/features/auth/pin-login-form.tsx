"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { User } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Delete, UserCheck, AlertTriangle, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinLoginFormProps {
  users: User[];
  onSuccessLogin: (user: User) => void;
}

export function PinLoginForm({ users, onSuccessLogin }: PinLoginFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.base_role.replace("_", " ").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const handleKeyPress = (num: string) => {
    if (isLocked) return;
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg("");

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg("");
    }
  };

  const verifyPin = async (inputPin: string) => {
    if (!selectedUser) {
      setErrorMsg("Pilih nama anggota terlebih dahulu!");
      setPin("");
      return;
    }

    let apiErrorMsg = "";
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUser.id, pin: inputPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPin("");
        setErrorMsg("");
        setFailedAttempts(0);
        onSuccessLogin(data.user || selectedUser);
        return;
      }
      if (data.is_locked) {
        setIsLocked(true);
        setErrorMsg(data.error || "Akun terkunci 15 menit karena 5x salah PIN.");
        setPin("");
        return;
      }
      apiErrorMsg = data.error || "";
    } catch {
      apiErrorMsg = "Gagal terhubung ke server.";
    }

    const nextFailed = failedAttempts + 1;
    setFailedAttempts(nextFailed);
    setPin("");
    if (nextFailed >= 5) {
      setIsLocked(true);
      setErrorMsg("Akun terkunci 15 menit karena 5x salah PIN. Hubungi Creative Leader / Superadmin.");
    } else {
      setErrorMsg(apiErrorMsg || `PIN salah! Percobaan ${nextFailed}/5.`);
    }
  };

  const resetSelection = () => {
    setSelectedUserId("");
    setPin("");
    setErrorMsg("");
  };

  if (!selectedUser) {
    return (
      <div className="space-y-3.5">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-center space-y-3">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-slate-900">
                Belum Ada Akun Terdaftar
              </h3>
              <p className="text-xs text-slate-500">
                Database belum memiliki pengguna. Silakan daftarkan akun pertama Anda terlebih dahulu.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-sm hover:opacity-95 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Daftar Akun Pertama</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama anggota atau divisi..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition"
              />
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredUsers.map((user) => {
                const initials = user.full_name
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 transition text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{user.full_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{user.base_role.replace("_", " ")}</div>
                      </div>
                    </div>
                    {user.is_superadmin && (
                      <Badge variant="purple" className="text-[10px] shrink-0">
                        Superadmin
                      </Badge>
                    )}
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  Nama anggota tidak ditemukan.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <Link
                href="/register"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Belum punya akun? Daftar sekarang</span>
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
            {selectedUser.full_name}
          </span>
        </div>
        <button
          type="button"
          onClick={resetSelection}
          className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline font-semibold shrink-0"
        >
          Ganti Nama
        </button>
      </div>

      {/* PIN Indicators */}
      <div className="flex items-center gap-4 my-4" aria-label="Indikator 4 digit PIN">
        {[0, 1, 2, 3].map((idx) => {
          const isFilled = pin.length > idx;
          return (
            <div
              key={idx}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-200",
                isFilled
                  ? "bg-indigo-600 border-indigo-600 scale-110 shadow-sm shadow-indigo-600/30"
                  : "border-slate-300 bg-slate-100"
              )}
            />
          );
        })}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl w-full mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
          <button
            key={num}
            type="button"
            disabled={isLocked}
            onClick={() => handleKeyPress(num)}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-900 font-bold text-xl active:scale-95 transition disabled:opacity-40"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          type="button"
          disabled={isLocked}
          onClick={() => handleKeyPress("0")}
          className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-900 font-bold text-xl active:scale-95 transition disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          disabled={isLocked || pin.length === 0}
          onClick={handleDelete}
          aria-label="Hapus digit PIN"
          className="h-14 rounded-2xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 flex items-center justify-center active:scale-95 transition disabled:opacity-40"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
