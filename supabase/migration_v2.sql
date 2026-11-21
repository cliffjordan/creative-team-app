-- ==============================================================================
-- CREATIVE TEAM EVENT OS - MIGRATION V2
-- Supports: Auto-Role Member Management, Gambar 1 Budget Ledger,
-- Unified Secretariat (Committee & Ministers Structure), and 1-Doc-Per-Event Brief
-- ==============================================================================

BEGIN;

-- 1. Penambahan kolom status penugasan role & divisi default pada public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_section section_type NULL,
  ADD COLUMN IF NOT EXISTS is_role_assigned BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.users
SET is_role_assigned = TRUE
WHERE base_role <> 'MEMBER' OR is_superadmin = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_is_role_assigned ON public.users (is_role_assigned);
CREATE INDEX IF NOT EXISTS idx_users_default_section ON public.users (default_section);

-- 2. Perluasan kolom public.event_budget_ledger sesuai Gambar 1
ALTER TABLE public.event_budget_ledger
  ADD COLUMN IF NOT EXISTS budget_category TEXT NOT NULL DEFAULT 'Dekorasi',
  ADD COLUMN IF NOT EXISTS required_date DATE NULL,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS uom TEXT NOT NULL DEFAULT 'Set',
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_status TEXT NOT NULL DEFAULT 'Planning';

CREATE INDEX IF NOT EXISTS idx_budget_ledger_required_date
  ON public.event_budget_ledger (required_date)
  WHERE required_date IS NOT NULL;

-- 3. Tabel Struktur Panitia (Sekretariat -> Struktur Builder -> Bagian 05 Dokumen)
CREATE TABLE IF NOT EXISTS public.event_committee_structure (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  order_index   INTEGER NOT NULL DEFAULT 0,
  position_name TEXT NOT NULL,
  pic_user_id   UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  pic_name      TEXT NOT NULL,
  contact_notes TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_committee_event_order
  ON public.event_committee_structure (event_id, order_index);

-- 4. Tabel Struktur Pelayan (Sekretariat -> Struktur Pelayan -> Bagian 06 Dokumen)
CREATE TABLE IF NOT EXISTS public.event_ministers_structure (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  order_index    INTEGER NOT NULL DEFAULT 0,
  ministry_role  TEXT NOT NULL,
  minister_names TEXT NOT NULL,
  notes          TEXT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ministers_event_order
  ON public.event_ministers_structure (event_id, order_index);

-- 5. Tabel Dokumen Event Project Brief (Single Source: 1 Dokumen per event_id)
CREATE TABLE IF NOT EXISTS public.event_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  document_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  org_chart_url   TEXT NULL,
  created_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by      UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  tasks_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_documents_event_id
  ON public.event_documents (event_id);

-- 6. Triggers updated_at
DROP TRIGGER IF EXISTS trg_event_committee_updated_at ON public.event_committee_structure;
CREATE TRIGGER trg_event_committee_updated_at
  BEFORE UPDATE ON public.event_committee_structure
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_event_ministers_updated_at ON public.event_ministers_structure;
CREATE TRIGGER trg_event_ministers_updated_at
  BEFORE UPDATE ON public.event_ministers_structure
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_event_documents_updated_at ON public.event_documents;
CREATE TRIGGER trg_event_documents_updated_at
  BEFORE UPDATE ON public.event_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Row Level Security & Policies (konsisten dengan schema.sql)
ALTER TABLE public.event_committee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ministers_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_committee_all_policy ON public.event_committee_structure;
CREATE POLICY event_committee_all_policy
  ON public.event_committee_structure FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS event_ministers_all_policy ON public.event_ministers_structure;
CREATE POLICY event_ministers_all_policy
  ON public.event_ministers_structure FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS event_documents_all_policy ON public.event_documents;
CREATE POLICY event_documents_all_policy
  ON public.event_documents FOR ALL USING (true) WITH CHECK (true);

COMMIT;
