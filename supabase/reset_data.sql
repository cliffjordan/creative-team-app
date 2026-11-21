-- ============================================================================
-- RESET DATA ONLY (MEMPERTAHANKAN STRUKTUR TABEL, RELASI, INDEX, & RLS POLICY)
-- ============================================================================
-- Jalankan script ini di Supabase SQL Editor untuk mengosongkan seluruh data
-- tanpa menghapus tabel, tipe ENUM, trigger, maupun RLS policy.
-- ============================================================================

BEGIN;

-- Putuskan referensi sirkular sementara antara events dan rundown_items
UPDATE public.events SET current_item_id = NULL;

TRUNCATE TABLE
  public.operation_records,
  public.notifications,
  public.pdd_references,
  public.section_decor_items,
  public.section_pdd_shotlist,
  public.section_tools_inventory,
  public.event_meeting_notes,
  public.event_budget_ledger,
  public.event_technical_guides,
  public.timeline_tasks,
  public.live_logs,
  public.rundown_items,
  public.rundowns,
  public.event_roster,
  public.events,
  public.users
RESTART IDENTITY CASCADE;

COMMIT;

-- Pastikan RPC verify_user_pin menyertakan schema extensions (pgcrypto)
ALTER FUNCTION public.verify_user_pin(UUID, TEXT)
SET search_path = public, extensions;
