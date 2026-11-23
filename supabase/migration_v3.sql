-- ============================================================================
-- CREATIVE HUB — MIGRATION V3 (ROLE GOVERNANCE, ROSTER 1-SECTION, PIC AUDIT)
-- Fokus:
-- 1. Pemisahan Superadmin vs Creative Leader & normalisasi is_role_assigned
-- 2. Aturan 1 Member = Maksimal 1 Section per Event pada public.event_roster
-- 3. Kolom alasan & riwayat delegasi PIC pada public.timeline_tasks
-- 4. Dukungan log audit global Superadmin pada public.operation_records
-- ============================================================================

BEGIN;

-- 1. Normalisasi users: user yang sudah memiliki jabatan inti aktif
--    tidak lagi wajib memiliki default_section global.
UPDATE public.users
SET is_role_assigned = TRUE
WHERE is_superadmin = TRUE
   OR base_role IN ('CREATIVE_LEADER', 'WAKIL_LEADER', 'SEKRETARIS', 'BENDAHARA', 'SECTION_LEADER')
   OR default_section IS NOT NULL;

-- Pastikan minimal 1 Superadmin aktif (jika belum ada, promosikan Creative Leader tertua)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE is_superadmin = TRUE) THEN
    UPDATE public.users
    SET is_superadmin = TRUE
    WHERE id = (
      SELECT id FROM public.users
      WHERE base_role = 'CREATIVE_LEADER'
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
END $$;

-- 2. Deduplikasi event_roster sebelum memasang UNIQUE(event_id, user_id)
--    Pertahankan role tertinggi (non-MEMBER) atau entri terbaru
DELETE FROM public.event_roster a
USING public.event_roster b
WHERE a.event_id = b.event_id
  AND a.user_id = b.user_id
  AND a.id <> b.id
  AND (
    (a.role_in_event = 'MEMBER' AND b.role_in_event <> 'MEMBER')
    OR (a.role_in_event = b.role_in_event AND a.created_at < b.created_at)
    OR (a.role_in_event = b.role_in_event AND a.created_at = b.created_at AND a.id::text < b.id::text)
  );

-- Hapus constraint lama UNIQUE(event_id, user_id, section) dan ganti dengan UNIQUE(event_id, user_id)
ALTER TABLE public.event_roster
  DROP CONSTRAINT IF EXISTS uq_event_roster_user_section;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_event_roster_single_section'
  ) THEN
    ALTER TABLE public.event_roster
      ADD CONSTRAINT uq_event_roster_single_section UNIQUE (event_id, user_id);
  END IF;
END $$;

-- 3. Tambahkan kolom alasan & riwayat pergantian PIC pada public.timeline_tasks
ALTER TABLE public.timeline_tasks
  ADD COLUMN IF NOT EXISTS pic_change_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS pic_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Pastikan operation_records mendukung audit global Superadmin (event_id opsional + kolom details)
CREATE TABLE IF NOT EXISTS public.operation_records (
  operation_id UUID PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  details JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.operation_records
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.operation_records
  ADD COLUMN IF NOT EXISTS details JSONB NULL DEFAULT '{}'::jsonb;

COMMIT;
