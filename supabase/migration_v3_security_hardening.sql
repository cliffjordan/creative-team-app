-- ==============================================================================
-- CREATIVE TEAM EVENT OS - MIGRATION V3 (SECURITY HARDENING & SAFE DELETION)
-- Implements P0 Audit Remediations:
-- 1. Safe FK deletion (ON DELETE SET NULL on event_documents.created_by & live_logs.reported_by)
-- 2. Events schema alignment (dresscode, segment_pause_seconds)
-- 3. RLS Hardening: block direct anon table writes & sensitive reads via PostgREST
-- ==============================================================================

BEGIN;

-- 1. Safe FK deletion for user cleanup from Manajemen Member
ALTER TABLE public.event_documents
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.event_documents
  DROP CONSTRAINT IF EXISTS event_documents_created_by_fkey;

ALTER TABLE public.event_documents
  ADD CONSTRAINT event_documents_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.live_logs
  DROP CONSTRAINT IF EXISTS live_logs_reported_by_fkey;

ALTER TABLE public.live_logs
  ADD CONSTRAINT live_logs_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Schema alignment for events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dresscode TEXT NULL,
  ADD COLUMN IF NOT EXISTS segment_pause_seconds INTEGER NOT NULL DEFAULT 0;

-- 3. RLS Hardening — Sensitive & Internal Tables (service_role ONLY)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'event_roster',
    'rundowns',
    'event_technical_guides',
    'event_budget_ledger',
    'event_meeting_notes',
    'section_tools_inventory',
    'section_pdd_shotlist',
    'section_decor_items',
    'event_committee_structure',
    'event_ministers_structure',
    'event_documents',
    'operation_records',
    'notifications',
    'pdd_references'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        tbl || '_service_role_all',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4. RLS Hardening — Realtime-Subscribed Tables (SELECT allowed for realtime listeners, write locked to service_role)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['events', 'rundown_items', 'live_logs', 'timeline_tasks']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
        tbl || '_realtime_select',
        tbl
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        tbl || '_service_role_write',
        tbl
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
