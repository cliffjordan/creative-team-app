-- ============================================================================
-- CREATIVE HUB — MIGRATION V4
-- Fokus:
-- 1. Isolasi akun teknis SUPERADMIN dari akun operasional CREATIVE_LEADER
-- 2. Jaminan ON DELETE CASCADE pada seluruh tabel anak events & ON DELETE SET NULL
--    pada operation_records agar log alasan penghapusan event tidak ikut terhapus
-- ============================================================================

BEGIN;

-- 1. Pisahkan akun teknis System Superadmin dari akun operasional CREATIVE_LEADER.
DO $$
DECLARE
  v_default_pin_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_default_pin_hash
  FROM public.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_default_pin_hash IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = 'superadmin@creativehub.local'
  ) THEN
    INSERT INTO public.users (
      full_name,
      email,
      phone,
      pin_hash,
      is_superadmin,
      base_role,
      default_section,
      is_role_assigned,
      failed_pin_attempts
    ) VALUES (
      'System Superadmin',
      'superadmin@creativehub.local',
      '+6280000000000',
      v_default_pin_hash,
      TRUE,
      'MEMBER',
      NULL,
      TRUE,
      0
    );
  END IF;

  -- Lepaskan flag teknis is_superadmin dari akun operasional CREATIVE_LEADER
  -- setelah akun khusus System Superadmin tersedia.
  IF EXISTS (
    SELECT 1 FROM public.users WHERE email = 'superadmin@creativehub.local' AND is_superadmin = TRUE
  ) THEN
    UPDATE public.users
    SET is_superadmin = FALSE
    WHERE base_role = 'CREATIVE_LEADER'
      AND (email IS DISTINCT FROM 'superadmin@creativehub.local');
  END IF;
END $$;

-- 2. Pastikan operation_records menggunakan ON DELETE SET NULL pada event_id
--    agar rekaman audit (termasuk alasan penghapusan event PRE_EVENT) tetap tersimpan
--    setelah row di public.events dihapus.
ALTER TABLE public.operation_records
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.operation_records
  ADD COLUMN IF NOT EXISTS details JSONB NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.operation_records
  DROP CONSTRAINT IF EXISTS operation_records_event_id_fkey;

ALTER TABLE public.operation_records
  ADD CONSTRAINT operation_records_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

-- 3. Pastikan seluruh tabel anak public.events lainnya memiliki ON DELETE CASCADE
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'events'
      AND kcu.column_name = 'event_id'
      AND tc.table_name <> 'operation_records'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE',
      r.table_name,
      r.constraint_name
    );
  END LOOP;
END $$;

COMMIT;
