"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { ProfileEditView } from "@/features/profile/profile-edit-view";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function ProfilePage() {
  const { currentUser, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-rose-500 to-cyan-500" />
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Workspace</span>
          </Link>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="text-xs font-extrabold text-slate-900">Creative Team</span>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="h-48 rounded-2xl bg-slate-200/70 animate-pulse" />
        ) : (
          <ProfileEditView currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}
