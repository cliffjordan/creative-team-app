-- ==============================================================================
-- ⛪ CHURCH CREATIVE TEAM EVENT OS - PRODUCTION DATABASE SCHEMA
-- ==============================================================================
-- System Architecture: CyberPanel / aaPanel Modern Dark Dashboard
-- Database Engine: PostgreSQL 14+ / Supabase
-- Target File: supabase/schema.sql
-- Security: Row Level Security (RLS) + bcrypt PIN Hashing + Anti-Brute Force Lockout
-- Realtime: Enabled on events, rundown_items, live_logs, timeline_tasks
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
-- pgcrypto provides crypt() and gen_salt('bf') for salted bcrypt PIN hashing
-- uuid-ossp provides legacy UUID generation if needed (gen_random_uuid is native)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. CUSTOM ENUM TYPES
-- ------------------------------------------------------------------------------

-- User organization base role
DO $$ BEGIN
  CREATE TYPE user_base_role AS ENUM (
    'CREATIVE_LEADER',
    'WAKIL_LEADER',
    'SEKRETARIS',
    'BENDAHARA',
    'SECTION_LEADER',
    'MEMBER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lifecycle status of church events
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'DRAFT',
    'PRE_EVENT',
    'EVENT_DAY',
    'POST_EVENT',
    'COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Creative department sections
DO $$ BEGIN
  CREATE TYPE section_type AS ENUM (
    'ACARA',
    'DEKORASI',
    'PERLENGKAPAN',
    'PDD',
    'INTI',
    'ALL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dynamic role assigned to a member per event
DO $$ BEGIN
  CREATE TYPE event_role AS ENUM (
    'EVENT_LEADER',
    'CO_CONTROLLER',
    'SECTION_LEADER',
    'MEMBER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status of individual rundown segment during planning and live execution
DO $$ BEGIN
  CREATE TYPE rundown_item_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'FINISHED',
    'SKIPPED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Categorization of live operational logs and variance audits
DO $$ BEGIN
  CREATE TYPE log_type AS ENUM (
    'OVERTIME',
    'EARLYEND',
    'CHANGEQUEUE',
    'INCIDENT',
    'PAUSE',
    'RESUME'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Incident & alert severity
DO $$ BEGIN
  CREATE TYPE log_severity AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Resolution status for variance logs and reported incidents
DO $$ BEGIN
  CREATE TYPE log_status AS ENUM (
    'OPEN',
    'RESOLVED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pre/Day/Post phases for task delegation
DO $$ BEGIN
  CREATE TYPE task_phase AS ENUM (
    'PRE_EVENT',
    'EVENT_DAY',
    'POST_EVENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task kanban board status
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'ESCALATED',
    'DONE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CORE RELATIONAL TABLES
-- ------------------------------------------------------------------------------

-- 3.1 USERS & AUTHENTICATION TABLE
-- Implements 4-digit PIN authentication with salted bcrypt hashes and lockout counter
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT NOT NULL, -- WhatsApp format, e.g. +628123456789
  pin_hash TEXT NOT NULL, -- Stored as bcrypt hash: crypt('1234', gen_salt('bf'))
  is_superadmin BOOLEAN NOT NULL DEFAULT false,
  base_role user_base_role NOT NULL DEFAULT 'MEMBER',
  default_section section_type,
  is_role_assigned BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_pin_attempts >= 0),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 EVENTS TABLE
-- Holds the master event records and the active live rundown runtime state
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  theme TEXT,
  dresscode TEXT,
  event_date DATE NOT NULL,
  status event_status NOT NULL DEFAULT 'DRAFT',
  live_started_at TIMESTAMPTZ,
  live_ended_at TIMESTAMPTZ,
  live_paused_at TIMESTAMPTZ,
  total_pause_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_pause_seconds >= 0),
  segment_pause_seconds INTEGER NOT NULL DEFAULT 0 CHECK (segment_pause_seconds >= 0),
  current_item_id UUID, -- Foreign key to rundown_items(id) added after rundown_items creation
  current_item_started_at TIMESTAMPTZ,
  time_tolerance_seconds INTEGER NOT NULL DEFAULT 60 CHECK (time_tolerance_seconds >= 0),
  event_leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 EVENT ROSTER (DYNAMIC MULTI-ROLE ASSIGNMENTS)
-- Links users to events with dynamic section assignments and fail-safe controller privileges
CREATE TABLE IF NOT EXISTS event_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section section_type NOT NULL DEFAULT 'ALL',
  role_in_event event_role NOT NULL DEFAULT 'MEMBER',
  is_co_controller BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_roster_user_section UNIQUE (event_id, user_id, section)
);

-- 3.4 RUNDOWNS (EVENT SPECIFIC OR REUSABLE TEMPLATES)
CREATE TABLE IF NOT EXISTS rundowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_template BOOLEAN NOT NULL DEFAULT false,
  template_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rundown_template_or_event CHECK (is_template = true OR event_id IS NOT NULL)
);

-- 3.5 RUNDOWN ITEMS (PROGRAM SEGMENTS & LIVE RUNTIME TRACKING)
CREATE TABLE IF NOT EXISTS rundown_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rundown_id UUID NOT NULL REFERENCES rundowns(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  title TEXT NOT NULL,
  section_pic section_type NOT NULL DEFAULT 'ACARA',
  pic_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  planned_start_time TIME,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_duration_minutes >= 0),
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  status rundown_item_status NOT NULL DEFAULT 'PENDING',
  technical_notes TEXT,
  cue_props TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Establish foreign key from events.current_item_id to rundown_items.id
DO $$ BEGIN
  ALTER TABLE events
  ADD CONSTRAINT fk_events_current_item
  FOREIGN KEY (current_item_id)
  REFERENCES rundown_items(id)
  ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3.6 LIVE LOGS (VARIANCE AUDIT, CHANGE QUEUE & INCIDENT TRACKER)
-- Append-only audit trail for overtime, early-end, queue swap, pause/resume, and field incidents
CREATE TABLE IF NOT EXISTS live_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rundown_item_id UUID REFERENCES rundown_items(id) ON DELETE SET NULL,
  log_type log_type NOT NULL,
  delta_seconds INTEGER, -- Negative if ended early, positive if overtime
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  severity log_severity NOT NULL DEFAULT 'LOW',
  status log_status NOT NULL DEFAULT 'OPEN',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 TIMELINE TASKS (PRE-EVENT, EVENT DAY & POST-EVENT KANBAN)
CREATE TABLE IF NOT EXISTS timeline_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section section_type NOT NULL DEFAULT 'ALL',
  phase task_phase NOT NULL DEFAULT 'PRE_EVENT',
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'TODO',
  escalation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 EVENT TECHNICAL GUIDES (SMART CUE CARDS & STAGE LAYOUTS)
CREATE TABLE IF NOT EXISTS event_technical_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- e.g., 'CANDLE_LIGHT', 'STAGE_LAYOUT', 'SEATING_PLAN', 'GATE_FLOW'
  title TEXT NOT NULL,
  instructions_markdown TEXT NOT NULL,
  layout_image_url TEXT,
  target_sections TEXT[] NOT NULL DEFAULT '{ALL}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9 EVENT BUDGET LEDGER (SIMPLIFIED FINANCIAL TRACKING & RECEIPT UPLOADS)
CREATE TABLE IF NOT EXISTS event_budget_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section section_type NOT NULL DEFAULT 'ALL',
  budget_category TEXT NOT NULL DEFAULT 'Dekorasi',
  item_name TEXT NOT NULL,
  required_date DATE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  uom TEXT NOT NULL DEFAULT 'Set',
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
  actual_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (actual_amount >= 0),
  budget_status TEXT NOT NULL DEFAULT 'Planning',
  receipt_photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9B EVENT COMMITTEE STRUCTURE (SEKRETARIAT -> STRUKTUR BUILDER)
CREATE TABLE IF NOT EXISTS event_committee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  position_name TEXT NOT NULL,
  pic_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pic_name TEXT NOT NULL,
  contact_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9C EVENT MINISTERS STRUCTURE (SEKRETARIAT -> STRUKTUR PELAYAN)
CREATE TABLE IF NOT EXISTS event_ministers_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  ministry_role TEXT NOT NULL,
  minister_names TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9D EVENT PROJECT BRIEF DOCUMENTS (1 DOCUMENT PER EVENT)
CREATE TABLE IF NOT EXISTS event_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  document_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  org_chart_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  tasks_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.10 EVENT MEETING NOTES (SECRETARIAT COORDINATION NOTULENSI)
CREATE TABLE IF NOT EXISTS event_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL, -- e.g., 'COORDINATION', 'TECHNICAL_MEETING', 'POST_EVALUATION'
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes_content TEXT NOT NULL,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.11 SECTION TOOLS INVENTORY (PERLENGKAPAN READINESS CHECKLIST)
CREATE TABLE IF NOT EXISTS section_tools_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  source TEXT NOT NULL DEFAULT 'IN_HOUSE' CHECK (source IN ('IN_HOUSE', 'RENTAL', 'PURCHASE')),
  pic_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 SECTION PDD SHOTLIST (MULTIMEDIA / DOCUMENTATION SCENE LIST)
CREATE TABLE IF NOT EXISTS section_pdd_shotlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  scene_title TEXT NOT NULL,
  shot_type TEXT NOT NULL DEFAULT 'PHOTO' CHECK (shot_type IN ('PHOTO', 'VIDEO', 'REEL', 'OTHER')),
  camera_angle TEXT,
  pic_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'TAKEN', 'EDITED', 'UPLOADED')),
  drive_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.13 SECTION DECORATION ITEMS (DEKORASI PROGRESS & COST TRACKING)
CREATE TABLE IF NOT EXISTS section_decor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  estimated_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (actual_cost >= 0),
  installation_status TEXT NOT NULL DEFAULT 'PLANNING' CHECK (installation_status IN ('PLANNING', 'IN_PROGRESS', 'READY', 'INSTALLED')),
  pic_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES (B-TREE ON ALL FKs, FILTERS, AND SORT KEYS)
-- ------------------------------------------------------------------------------

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_base_role ON users(base_role);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- Events table
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_event_leader_id ON events(event_leader_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_current_item_id ON events(current_item_id);

-- Event Roster table
CREATE INDEX IF NOT EXISTS idx_event_roster_event_id ON event_roster(event_id);
CREATE INDEX IF NOT EXISTS idx_event_roster_user_id ON event_roster(user_id);
CREATE INDEX IF NOT EXISTS idx_event_roster_section ON event_roster(section);
CREATE INDEX IF NOT EXISTS idx_event_roster_composite ON event_roster(event_id, user_id);

-- Rundowns table
CREATE INDEX IF NOT EXISTS idx_rundowns_event_id ON rundowns(event_id);
CREATE INDEX IF NOT EXISTS idx_rundowns_is_template ON rundowns(is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_rundowns_template_category ON rundowns(template_category) WHERE template_category IS NOT NULL;

-- Rundown Items table
CREATE INDEX IF NOT EXISTS idx_rundown_items_rundown_id ON rundown_items(rundown_id);
CREATE INDEX IF NOT EXISTS idx_rundown_items_order_index ON rundown_items(rundown_id, order_index);
CREATE INDEX IF NOT EXISTS idx_rundown_items_status ON rundown_items(status);
CREATE INDEX IF NOT EXISTS idx_rundown_items_pic_user_id ON rundown_items(pic_user_id);
CREATE INDEX IF NOT EXISTS idx_rundown_items_section_pic ON rundown_items(section_pic);

-- Live Logs table
CREATE INDEX IF NOT EXISTS idx_live_logs_event_id ON live_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_live_logs_rundown_item_id ON live_logs(rundown_item_id);
CREATE INDEX IF NOT EXISTS idx_live_logs_log_type ON live_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_live_logs_status ON live_logs(status);
CREATE INDEX IF NOT EXISTS idx_live_logs_severity ON live_logs(severity);
CREATE INDEX IF NOT EXISTS idx_live_logs_reported_by ON live_logs(reported_by);
CREATE INDEX IF NOT EXISTS idx_live_logs_resolved_by ON live_logs(resolved_by);
CREATE INDEX IF NOT EXISTS idx_live_logs_created_at ON live_logs(created_at DESC);

-- Timeline Tasks table
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_event_id ON timeline_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_assigned_to ON timeline_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_section ON timeline_tasks(section);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_phase ON timeline_tasks(phase);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_status ON timeline_tasks(status);
CREATE INDEX IF NOT EXISTS idx_timeline_tasks_due_date ON timeline_tasks(due_date);

-- Technical Guides table
CREATE INDEX IF NOT EXISTS idx_technical_guides_event_id ON event_technical_guides(event_id);
CREATE INDEX IF NOT EXISTS idx_technical_guides_category ON event_technical_guides(category);

-- Budget Ledger table
CREATE INDEX IF NOT EXISTS idx_budget_ledger_event_id ON event_budget_ledger(event_id);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_section ON event_budget_ledger(section);

-- Meeting Notes table
CREATE INDEX IF NOT EXISTS idx_meeting_notes_event_id ON event_meeting_notes(event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_recorded_by ON event_meeting_notes(recorded_by);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting_date ON event_meeting_notes(meeting_date);

-- Tools Inventory table
CREATE INDEX IF NOT EXISTS idx_tools_inventory_event_id ON section_tools_inventory(event_id);
CREATE INDEX IF NOT EXISTS idx_tools_inventory_pic_user ON section_tools_inventory(pic_user_id);
CREATE INDEX IF NOT EXISTS idx_tools_inventory_is_ready ON section_tools_inventory(is_ready);

-- PDD Shotlist table
CREATE INDEX IF NOT EXISTS idx_pdd_shotlist_event_id ON section_pdd_shotlist(event_id);
CREATE INDEX IF NOT EXISTS idx_pdd_shotlist_pic_user ON section_pdd_shotlist(pic_user_id);
CREATE INDEX IF NOT EXISTS idx_pdd_shotlist_status ON section_pdd_shotlist(status);

-- Decor Items table
CREATE INDEX IF NOT EXISTS idx_decor_items_event_id ON section_decor_items(event_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_pic_user ON section_decor_items(pic_user_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_status ON section_decor_items(installation_status);

-- ------------------------------------------------------------------------------
-- 5. AUTOMATED TIMESTAMPS TRIGGER FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to all tables possessing updated_at
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rundowns_updated_at ON rundowns;
CREATE TRIGGER trg_rundowns_updated_at BEFORE UPDATE ON rundowns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rundown_items_updated_at ON rundown_items;
CREATE TRIGGER trg_rundown_items_updated_at BEFORE UPDATE ON rundown_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_timeline_tasks_updated_at ON timeline_tasks;
CREATE TRIGGER trg_timeline_tasks_updated_at BEFORE UPDATE ON timeline_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_event_technical_guides_updated_at ON event_technical_guides;
CREATE TRIGGER trg_event_technical_guides_updated_at BEFORE UPDATE ON event_technical_guides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_event_budget_ledger_updated_at ON event_budget_ledger;
CREATE TRIGGER trg_event_budget_ledger_updated_at BEFORE UPDATE ON event_budget_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_event_meeting_notes_updated_at ON event_meeting_notes;
CREATE TRIGGER trg_event_meeting_notes_updated_at BEFORE UPDATE ON event_meeting_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_section_tools_inventory_updated_at ON section_tools_inventory;
CREATE TRIGGER trg_section_tools_inventory_updated_at BEFORE UPDATE ON section_tools_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_section_pdd_shotlist_updated_at ON section_pdd_shotlist;
CREATE TRIGGER trg_section_pdd_shotlist_updated_at BEFORE UPDATE ON section_pdd_shotlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_section_decor_items_updated_at ON section_decor_items;
CREATE TRIGGER trg_section_decor_items_updated_at BEFORE UPDATE ON section_decor_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. SECURITY & BUSINESS LOGIC STORED PROCEDURES
-- ------------------------------------------------------------------------------

-- 6.1 VERIFY USER PIN WITH BRUTE-FORCE LOCKOUT (15 MINUTES AFTER 5 FAILURES)
CREATE OR REPLACE FUNCTION verify_user_pin(
  p_user_id UUID,
  p_pin TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Acquire row lock to prevent race conditions during rapid concurrent PIN attempts
  SELECT id, pin_hash, failed_pin_attempts, locked_until
  INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Check if user is actively locked out
  IF v_user.locked_until IS NOT NULL THEN
    IF v_user.locked_until > now() THEN
      RETURN FALSE;
    ELSE
      -- Lockout window expired, clear lock
      v_user.locked_until := NULL;
      v_user.failed_pin_attempts := 0;
    END IF;
  END IF;

  -- 2. Validate PIN using bcrypt crypt()
  IF v_user.pin_hash = crypt(p_pin, v_user.pin_hash) THEN
    -- Success: reset failed attempts & release any lockout
    UPDATE users
    SET failed_pin_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE id = p_user_id;

    RETURN TRUE;
  ELSE
    -- Failure: increment counter and lock for 15 minutes if 5th failure reached
    IF v_user.failed_pin_attempts + 1 >= 5 THEN
      UPDATE users
      SET failed_pin_attempts = v_user.failed_pin_attempts + 1,
          locked_until = now() + INTERVAL '15 minutes',
          updated_at = now()
      WHERE id = p_user_id;
    ELSE
      UPDATE users
      SET failed_pin_attempts = v_user.failed_pin_attempts + 1,
          updated_at = now()
      WHERE id = p_user_id;
    END IF;

    RETURN FALSE;
  END IF;
END;
$$;

-- 6.2 HELPER FUNCTION TO SAFELY SET / CHANGE USER PIN
CREATE OR REPLACE FUNCTION set_user_pin(
  p_user_id UUID,
  p_new_pin TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(p_new_pin) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 digits';
  END IF;

  UPDATE users
  SET pin_hash = crypt(p_new_pin, gen_salt('bf')),
      failed_pin_attempts = 0,
      locked_until = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- 6.3 CORE LIVE CONTROLLER: ADVANCE SEGMENT, AUTO-OVERTIME LOG & REALTIME PUBLISH
CREATE OR REPLACE FUNCTION advance_live_rundown_segment(
  p_event_id UUID,
  p_actor_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_current_item RECORD;
  v_next_item RECORD;
  v_actual_duration_seconds INTEGER := 0;
  v_planned_duration_seconds INTEGER := 0;
  v_delta_seconds INTEGER := 0;
  v_rundown_id UUID;
BEGIN
  -- 1. Acquire event lock
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Event tidak ditemukan');
  END IF;

  -- 2. Identify the active rundown associated with this event
  SELECT id INTO v_rundown_id FROM rundowns WHERE event_id = p_event_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Rundown untuk event ini belum dibuat');
  END IF;

  -- 3. Case A: Event hasn't started yet (live_started_at is NULL or current_item_id is NULL)
  IF v_event.current_item_id IS NULL THEN
    -- Find the first pending segment ordered by order_index
    SELECT * INTO v_next_item
    FROM rundown_items
    WHERE rundown_id = v_rundown_id AND status = 'PENDING'
    ORDER BY order_index ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Tidak ada item rundown berstatus PENDING');
    END IF;

    -- Activate the first segment
    UPDATE rundown_items
    SET status = 'ACTIVE',
        actual_start_at = now(),
        updated_at = now()
    WHERE id = v_next_item.id;

    -- Transition event to EVENT_DAY and store current item pointer
    UPDATE events
    SET status = 'EVENT_DAY',
        live_started_at = COALESCE(live_started_at, now()),
        current_item_id = v_next_item.id,
        current_item_started_at = now(),
        updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'START_EVENT',
      'event_id', p_event_id,
      'current_item_id', v_next_item.id,
      'title', v_next_item.title,
      'order_index', v_next_item.order_index,
      'started_at', now()
    );
  END IF;

  -- 4. Case B: An item is currently ACTIVE -> Complete it, calculate variance, and switch to next
  SELECT * INTO v_current_item FROM rundown_items WHERE id = v_event.current_item_id FOR UPDATE;

  IF FOUND THEN
    -- Mark active segment as FINISHED
    UPDATE rundown_items
    SET status = 'FINISHED',
        actual_end_at = now(),
        updated_at = now()
    WHERE id = v_current_item.id;

    -- Calculate actual vs planned duration in seconds
    v_actual_duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_current_item.actual_start_at, v_event.current_item_started_at, now())))::integer);
    v_planned_duration_seconds := (v_current_item.estimated_duration_minutes * 60);
    v_delta_seconds := v_actual_duration_seconds - v_planned_duration_seconds;

    -- Evaluate variance against event tolerance threshold
    IF v_delta_seconds > v_event.time_tolerance_seconds THEN
      -- Segment is OVERTIME
      INSERT INTO live_logs (
        event_id,
        rundown_item_id,
        log_type,
        delta_seconds,
        reported_by,
        description,
        severity,
        status
      ) VALUES (
        p_event_id,
        v_current_item.id,
        'OVERTIME',
        v_delta_seconds,
        p_actor_id,
        'Overtime pada segmen "' || v_current_item.title || '" (+' || ROUND(v_delta_seconds / 60.0, 1) || ' m). Durasi aktual: ' || ROUND(v_actual_duration_seconds / 60.0, 1) || ' m, Rencana: ' || v_current_item.estimated_duration_minutes || ' m.',
        CASE WHEN v_delta_seconds >= 300 THEN 'HIGH'::log_severity ELSE 'MEDIUM'::log_severity END,
        'OPEN'
      );
    ELSIF v_delta_seconds < -v_event.time_tolerance_seconds THEN
      -- Segment ended early
      INSERT INTO live_logs (
        event_id,
        rundown_item_id,
        log_type,
        delta_seconds,
        reported_by,
        description,
        severity,
        status
      ) VALUES (
        p_event_id,
        v_current_item.id,
        'EARLYEND',
        v_delta_seconds,
        p_actor_id,
        'Selesai lebih awal pada segmen "' || v_current_item.title || '" (' || ROUND(v_delta_seconds / 60.0, 1) || ' m). Durasi aktual: ' || ROUND(v_actual_duration_seconds / 60.0, 1) || ' m, Rencana: ' || v_current_item.estimated_duration_minutes || ' m.',
        'LOW',
        'OPEN'
      );
    END IF;
  END IF;

  -- 5. Find the next pending segment
  SELECT * INTO v_next_item
  FROM rundown_items
  WHERE rundown_id = v_rundown_id AND status = 'PENDING'
  ORDER BY order_index ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Activate next segment
    UPDATE rundown_items
    SET status = 'ACTIVE',
        actual_start_at = now(),
        updated_at = now()
    WHERE id = v_next_item.id;

    -- Update events table pointer
    UPDATE events
    SET current_item_id = v_next_item.id,
        current_item_started_at = now(),
        updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'NEXT_SEGMENT',
      'event_id', p_event_id,
      'previous_item_id', v_current_item.id,
      'previous_title', v_current_item.title,
      'actual_duration_seconds', v_actual_duration_seconds,
      'delta_seconds', v_delta_seconds,
      'current_item_id', v_next_item.id,
      'current_title', v_next_item.title,
      'order_index', v_next_item.order_index,
      'event_completed', false
    );
  ELSE
    -- No further pending items -> Event complete!
    UPDATE events
    SET current_item_id = NULL,
        current_item_started_at = NULL,
        status = 'POST_EVENT',
        live_ended_at = now(),
        updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'COMPLETE_EVENT',
      'event_id', p_event_id,
      'previous_item_id', v_current_item.id,
      'previous_title', v_current_item.title,
      'actual_duration_seconds', v_actual_duration_seconds,
      'delta_seconds', v_delta_seconds,
      'current_item_id', NULL,
      'event_completed', true
    );
  END IF;
END;
$$;

-- 6.4 FAIL-SAFE ENGINE: UNDO LAST SEGMENT TRANSITION (15-SECOND WINDOW)
CREATE OR REPLACE FUNCTION undo_advance_live_rundown(
  p_event_id UUID,
  p_actor_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_active_item RECORD;
  v_last_finished_item RECORD;
  v_rundown_id UUID;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Event tidak ditemukan');
  END IF;

  SELECT id INTO v_rundown_id FROM rundowns WHERE event_id = p_event_id LIMIT 1;

  -- 1. Get the current active item (if any) and revert it back to PENDING
  IF v_event.current_item_id IS NOT NULL THEN
    SELECT * INTO v_active_item FROM rundown_items WHERE id = v_event.current_item_id FOR UPDATE;
    IF FOUND THEN
      UPDATE rundown_items
      SET status = 'PENDING',
          actual_start_at = NULL,
          updated_at = now()
      WHERE id = v_active_item.id;
    END IF;
  END IF;

  -- 2. Find the most recently finished item to roll back to ACTIVE
  SELECT * INTO v_last_finished_item
  FROM rundown_items
  WHERE rundown_id = v_rundown_id AND status = 'FINISHED'
  ORDER BY actual_end_at DESC NULLS LAST, order_index DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tidak ada item yang dapat di-undo');
  END IF;

  -- Revert last finished item back to ACTIVE
  UPDATE rundown_items
  SET status = 'ACTIVE',
      actual_end_at = NULL,
      updated_at = now()
  WHERE id = v_last_finished_item.id;

  -- Point event back to this item
  UPDATE events
  SET current_item_id = v_last_finished_item.id,
      current_item_started_at = v_last_finished_item.actual_start_at,
      status = 'EVENT_DAY',
      live_ended_at = NULL,
      updated_at = now()
  WHERE id = p_event_id;

  -- Remove or mark the latest auto-generated OVERTIME/EARLYEND log from this undone transition
  DELETE FROM live_logs
  WHERE id = (
    SELECT id FROM live_logs
    WHERE event_id = p_event_id
      AND rundown_item_id = v_last_finished_item.id
      AND log_type IN ('OVERTIME', 'EARLYEND')
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', 'UNDO_ADVANCE',
    'restored_item_id', v_last_finished_item.id,
    'restored_title', v_last_finished_item.title
  );
END;
$$;

-- 6.5 EMERGENCY ENGINE: PAUSE & RESUME LIVE TIMER
CREATE OR REPLACE FUNCTION pause_live_event(
  p_event_id UUID,
  p_actor_id UUID,
  p_reason TEXT DEFAULT 'Kendala Teknis / Jeda Darurat'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET live_paused_at = now(),
      updated_at = now()
  WHERE id = p_event_id AND live_paused_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Event sedang tidak live atau sudah dalam kondisi pause');
  END IF;

  INSERT INTO live_logs (
    event_id,
    log_type,
    reported_by,
    description,
    severity,
    status
  ) VALUES (
    p_event_id,
    'PAUSE',
    p_actor_id,
    p_reason,
    'HIGH',
    'OPEN'
  );

  RETURN jsonb_build_object('success', true, 'action', 'EVENT_PAUSED', 'paused_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION resume_live_event(
  p_event_id UUID,
  p_actor_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paused_at TIMESTAMPTZ;
  v_pause_seconds INTEGER := 0;
BEGIN
  SELECT live_paused_at INTO v_paused_at FROM events WHERE id = p_event_id;

  IF v_paused_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Event tidak sedang dalam kondisi pause');
  END IF;

  v_pause_seconds := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_paused_at))::integer);

  UPDATE events
  SET live_paused_at = NULL,
      total_pause_seconds = total_pause_seconds + v_pause_seconds,
      updated_at = now()
  WHERE id = p_event_id;

  INSERT INTO live_logs (
    event_id,
    log_type,
    delta_seconds,
    reported_by,
    description,
    severity,
    status
  ) VALUES (
    p_event_id,
    'RESUME',
    v_pause_seconds,
    p_actor_id,
    'Timer dilanjutkan setelah jeda selama ' || ROUND(v_pause_seconds / 60.0, 1) || ' menit',
    'LOW',
    'RESOLVED'
  );

  RETURN jsonb_build_object('success', true, 'action', 'EVENT_RESUMED', 'paused_duration_seconds', v_pause_seconds);
END;
$$;

-- 6.6 CHANGE QUEUE LIVE: ATOMIC RE-INDEXING OF PENDING SEGMENTS
CREATE OR REPLACE FUNCTION reorder_live_pending_rundown_item(
  p_item_id UUID,
  p_target_order_index INTEGER,
  p_actor_id UUID,
  p_reason TEXT DEFAULT 'Perubahan urutan acara di lapangan'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_event_id UUID;
  v_old_index INTEGER;
BEGIN
  -- 1. Ensure target item is strictly PENDING
  SELECT ri.*, r.event_id INTO v_item
  FROM rundown_items ri
  JOIN rundowns r ON r.id = ri.rundown_id
  WHERE ri.id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Item rundown tidak ditemukan');
  END IF;

  IF v_item.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Hanya segmen berstatus PENDING yang dapat diubah urutannya');
  END IF;

  v_old_index := v_item.order_index;
  v_event_id := v_item.event_id;

  -- 2. Shift order indexes atomically
  IF p_target_order_index > v_old_index THEN
    UPDATE rundown_items
    SET order_index = order_index - 1
    WHERE rundown_id = v_item.rundown_id
      AND order_index > v_old_index
      AND order_index <= p_target_order_index
      AND status = 'PENDING';
  ELSE
    UPDATE rundown_items
    SET order_index = order_index + 1
    WHERE rundown_id = v_item.rundown_id
      AND order_index >= p_target_order_index
      AND order_index < v_old_index
      AND status = 'PENDING';
  END IF;

  -- Set new order index for the target item
  UPDATE rundown_items
  SET order_index = p_target_order_index,
      updated_at = now()
  WHERE id = p_item_id;

  -- 3. Log audit entry for evaluation
  INSERT INTO live_logs (
    event_id,
    rundown_item_id,
    log_type,
    reported_by,
    description,
    severity,
    status
  ) VALUES (
    v_event_id,
    p_item_id,
    'CHANGEQUEUE',
    p_actor_id,
    'Perubahan Urutan: "' || v_item.title || '" digeser dari urutan #' || v_old_index || ' ke #' || p_target_order_index || '. Alasan: ' || p_reason,
    'MEDIUM',
    'OPEN'
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', 'CHANGE_QUEUE',
    'item_id', p_item_id,
    'title', v_item.title,
    'old_order', v_old_index,
    'new_order', p_target_order_index
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on every table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE rundowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE rundown_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_technical_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_tools_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_pdd_shotlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_decor_items ENABLE ROW LEVEL SECURITY;

-- 7.1 USERS POLICIES
DROP POLICY IF EXISTS users_select_all ON users;
CREATE POLICY users_select_all ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS users_insert_policy ON users;
CREATE POLICY users_insert_policy ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS users_update_policy ON users;
CREATE POLICY users_update_policy ON users FOR UPDATE USING (true);

DROP POLICY IF EXISTS users_delete_policy ON users;
CREATE POLICY users_delete_policy ON users FOR DELETE USING (true);

-- 7.2 EVENTS POLICIES
DROP POLICY IF EXISTS events_select_policy ON events;
CREATE POLICY events_select_policy ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS events_all_policy ON events;
CREATE POLICY events_all_policy ON events FOR ALL USING (true) WITH CHECK (true);

-- 7.3 EVENT ROSTER POLICIES
DROP POLICY IF EXISTS event_roster_select_policy ON event_roster;
CREATE POLICY event_roster_select_policy ON event_roster FOR SELECT USING (true);

DROP POLICY IF EXISTS event_roster_all_policy ON event_roster;
CREATE POLICY event_roster_all_policy ON event_roster FOR ALL USING (true) WITH CHECK (true);

-- 7.4 RUNDOWNS POLICIES
DROP POLICY IF EXISTS rundowns_select_policy ON rundowns;
CREATE POLICY rundowns_select_policy ON rundowns FOR SELECT USING (true);

DROP POLICY IF EXISTS rundowns_all_policy ON rundowns;
CREATE POLICY rundowns_all_policy ON rundowns FOR ALL USING (true) WITH CHECK (true);

-- 7.5 RUNDOWN ITEMS POLICIES
DROP POLICY IF EXISTS rundown_items_select_policy ON rundown_items;
CREATE POLICY rundown_items_select_policy ON rundown_items FOR SELECT USING (true);

DROP POLICY IF EXISTS rundown_items_all_policy ON rundown_items;
CREATE POLICY rundown_items_all_policy ON rundown_items FOR ALL USING (true) WITH CHECK (true);

-- 7.6 LIVE LOGS POLICIES (OPEN ACCESS FOR FAST FIELD INCIDENT REPORTING)
DROP POLICY IF EXISTS live_logs_select_policy ON live_logs;
CREATE POLICY live_logs_select_policy ON live_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS live_logs_insert_policy ON live_logs;
CREATE POLICY live_logs_insert_policy ON live_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS live_logs_update_policy ON live_logs;
CREATE POLICY live_logs_update_policy ON live_logs FOR UPDATE USING (true);

DROP POLICY IF EXISTS live_logs_delete_policy ON live_logs;
CREATE POLICY live_logs_delete_policy ON live_logs FOR DELETE USING (true);

-- 7.7 TIMELINE TASKS POLICIES
DROP POLICY IF EXISTS timeline_tasks_select_policy ON timeline_tasks;
CREATE POLICY timeline_tasks_select_policy ON timeline_tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS timeline_tasks_all_policy ON timeline_tasks;
CREATE POLICY timeline_tasks_all_policy ON timeline_tasks FOR ALL USING (true) WITH CHECK (true);

-- 7.8 TECHNICAL GUIDES POLICIES
DROP POLICY IF EXISTS technical_guides_select_policy ON event_technical_guides;
CREATE POLICY technical_guides_select_policy ON event_technical_guides FOR SELECT USING (true);

DROP POLICY IF EXISTS technical_guides_all_policy ON event_technical_guides;
CREATE POLICY technical_guides_all_policy ON event_technical_guides FOR ALL USING (true) WITH CHECK (true);

-- 7.9 BUDGET LEDGER POLICIES
DROP POLICY IF EXISTS budget_ledger_select_policy ON event_budget_ledger;
CREATE POLICY budget_ledger_select_policy ON event_budget_ledger FOR SELECT USING (true);

DROP POLICY IF EXISTS budget_ledger_all_policy ON event_budget_ledger;
CREATE POLICY budget_ledger_all_policy ON event_budget_ledger FOR ALL USING (true) WITH CHECK (true);

-- 7.10 MEETING NOTES POLICIES
DROP POLICY IF EXISTS meeting_notes_select_policy ON event_meeting_notes;
CREATE POLICY meeting_notes_select_policy ON event_meeting_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS meeting_notes_all_policy ON event_meeting_notes;
CREATE POLICY meeting_notes_all_policy ON event_meeting_notes FOR ALL USING (true) WITH CHECK (true);

-- 7.11 TOOLS INVENTORY POLICIES
DROP POLICY IF EXISTS tools_inventory_select_policy ON section_tools_inventory;
CREATE POLICY tools_inventory_select_policy ON section_tools_inventory FOR SELECT USING (true);

DROP POLICY IF EXISTS tools_inventory_all_policy ON section_tools_inventory;
CREATE POLICY tools_inventory_all_policy ON section_tools_inventory FOR ALL USING (true) WITH CHECK (true);

-- 7.12 PDD SHOTLIST POLICIES
DROP POLICY IF EXISTS pdd_shotlist_select_policy ON section_pdd_shotlist;
CREATE POLICY pdd_shotlist_select_policy ON section_pdd_shotlist FOR SELECT USING (true);

DROP POLICY IF EXISTS pdd_shotlist_all_policy ON section_pdd_shotlist;
CREATE POLICY pdd_shotlist_all_policy ON section_pdd_shotlist FOR ALL USING (true) WITH CHECK (true);

-- 7.13 DECOR ITEMS POLICIES
DROP POLICY IF EXISTS decor_items_select_policy ON section_decor_items;
CREATE POLICY decor_items_select_policy ON section_decor_items FOR SELECT USING (true);

DROP POLICY IF EXISTS decor_items_all_policy ON section_decor_items;
CREATE POLICY decor_items_all_policy ON section_decor_items FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------------

-- Ensure the supabase_realtime publication exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Idempotently add real-time synchronized tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['events', 'rundown_items', 'live_logs', 'timeline_tasks']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE p.pubname = 'supabase_realtime' AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;

-- Set replica identity to FULL for proper realtime payloads on updates & deletes
ALTER TABLE events REPLICA IDENTITY FULL;
ALTER TABLE rundown_items REPLICA IDENTITY FULL;
ALTER TABLE live_logs REPLICA IDENTITY FULL;
ALTER TABLE timeline_tasks REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 9. IDEMPOTENT PRODUCTION SEED DATA
-- ------------------------------------------------------------------------------

-- 9.1 CORE CREATIVE TEAM MEMBERS (Default PIN: 1234)
INSERT INTO users (
  id,
  full_name,
  email,
  phone,
  pin_hash,
  is_superadmin,
  base_role,
  avatar_url
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Daniel Wicaksono',
    'daniel.leader@church.org',
    '+6281234567890',
    crypt('1234', gen_salt('bf')),
    true,
    'CREATIVE_LEADER',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Sarah Setiawan',
    'sarah.wakil@church.org',
    '+6281234567891',
    crypt('1234', gen_salt('bf')),
    false,
    'WAKIL_LEADER',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Grace Natalia',
    'grace.sekretaris@church.org',
    '+6281234567892',
    crypt('1234', gen_salt('bf')),
    false,
    'SEKRETARIS',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Jonathan Hartanto',
    'jonathan.bendahara@church.org',
    '+6281234567893',
    crypt('1234', gen_salt('bf')),
    false,
    'BENDAHARA',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Kevin Pratama',
    'kevin.acara@church.org',
    '+6281234567894',
    crypt('1234', gen_salt('bf')),
    false,
    'SECTION_LEADER',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    'Clarissa Lim',
    'clarissa.dekor@church.org',
    '+6281234567895',
    crypt('1234', gen_salt('bf')),
    false,
    'SECTION_LEADER',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000007',
    'Michael Tan',
    'michael.perlengkapan@church.org',
    '+6281234567896',
    crypt('1234', gen_salt('bf')),
    false,
    'SECTION_LEADER',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000008',
    'Andrew Chen',
    'andrew.pdd@church.org',
    '+6281234567897',
    crypt('1234', gen_salt('bf')),
    false,
    'SECTION_LEADER',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000009',
    'Ruth Anastasia',
    'ruth.acara@church.org',
    '+6281234567898',
    crypt('1234', gen_salt('bf')),
    false,
    'MEMBER',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'David Kurnia',
    'david.perlengkapan@church.org',
    '+6281234567899',
    crypt('1234', gen_salt('bf')),
    false,
    'MEMBER',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    'Timothy Samuel',
    'timothy.pdd@church.org',
    '+6281234567810',
    crypt('1234', gen_salt('bf')),
    false,
    'MEMBER',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'Jessica Veranda',
    'jessica.dekor@church.org',
    '+6281234567811',
    crypt('1234', gen_salt('bf')),
    false,
    'MEMBER',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  )
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    base_role = EXCLUDED.base_role,
    avatar_url = EXCLUDED.avatar_url;

-- 9.2 REUSABLE RUNDOWN TEMPLATE: KEBAKTIAN NATAL KREATIF
INSERT INTO rundowns (
  id,
  event_id,
  name,
  is_template,
  template_category
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'Template Kebaktian Natal Kreatif - A Savior is Born',
  true,
  'NATAL'
) ON CONFLICT (id) DO NOTHING;

-- Segments for the Christmas Template
INSERT INTO rundown_items (
  id,
  rundown_id,
  order_index,
  title,
  section_pic,
  pic_user_id,
  planned_start_time,
  estimated_duration_minutes,
  status,
  technical_notes,
  cue_props
) VALUES
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1,
    'Open Gate & Welcoming Jemaat',
    'ACARA',
    '00000000-0000-0000-0000-000000000009', -- Ruth
    '17:00:00',
    15,
    'PENDING',
    'Latar musik ambient Christmas akustik, slide QR kehadiran di LED utama',
    'Buku warta Natal, souvenir pintu masuk, hand sanitizer'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    2,
    'Countdown & Opening Cinematic Video',
    'PDD',
    '00000000-0000-0000-0000-000000000008', -- Andrew
    '17:15:00',
    3,
    'PENDING',
    'Lampu panggung padam total (blackout), audio video volume 0dB, switch ke input PC-1',
    'File video opening 4K, cue operator lighting standby'
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    3,
    'Praise & Worship (Joy to the World & Medley)',
    'ACARA',
    '00000000-0000-0000-0000-000000000005', -- Kevin
    '17:18:00',
    25,
    'PENDING',
    'Lighting cerah bergerak upbeat, font lirik gold bold 48pt di LED latar belakang',
    'Mic WL 1-3, Wireless In-Ear Monitor band aktif'
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    4,
    'Doa Pembukaan & Sambutan',
    'INTI',
    '00000000-0000-0000-0000-000000000001', -- Daniel
    '17:43:00',
    5,
    'PENDING',
    'Spotlight warm white ke tengah panggung, musik pengiring piano tipis',
    'Mic podium tengah'
  ),
  (
    '11000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    5,
    'Penampilan Drama Teatrikal / Musikal Remaja',
    'ACARA',
    '00000000-0000-0000-0000-000000000009', -- Ruth
    '17:48:00',
    20,
    'PENDING',
    'Pergantian lighting 4 scene sesuai naskah, fog machine aktif di scene 2 dan 4',
    'Kostum gembala & orang majus, properti bintang Natal, wireless clip-on 4 unit'
  ),
  (
    '11000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    6,
    'Khotbah & Renungan Firman Tuhan',
    'INTI',
    '00000000-0000-0000-0000-000000000002', -- Sarah
    '18:08:00',
    35,
    'PENDING',
    'Static soft lighting warm white 3200K, mic headworn pembicara, slide khotbah sync',
    'Alkitab mimbar, pointer presentasi, timer display lantai untuk pembicara'
  ),
  (
    '11000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000001',
    7,
    'Candle Light Service (Malam Kudus)',
    'ACARA',
    '00000000-0000-0000-0000-000000000005', -- Kevin
    '18:43:00',
    15,
    'PENDING',
    'Padamkan seluruh lampu gedung bertahap, hanya spotlight lilin induk, paduan suara masuk',
    'Lilin induk 1 unit, lilin jemaat 500 pcs, pemantik api usher 10 pcs'
  ),
  (
    '11000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    8,
    'Doa Syafaat, Berkat & Persembahan',
    'INTI',
    '00000000-0000-0000-0000-000000000004', -- Jonathan
    '18:58:00',
    10,
    'PENDING',
    'Lampu aula utama menyala redup 50%, QRIS persembahan tampil di layar projector',
    'Kantong persembahan 8 unit, usher standby di tiap lorong'
  ),
  (
    '11000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000001',
    9,
    'Warta Jemaat, Pengumuman & Foto Bersama',
    'PDD',
    '00000000-0000-0000-0000-000000000011', -- Timothy
    '19:08:00',
    10,
    'PENDING',
    'Lampu hall 100% full bright white, fotografer utama naik ke stage tengah',
    'Lensa wide 16-35mm, flash trigger, ladder tangga foto'
  ),
  (
    '11000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000001',
    10,
    'Closing, Ramah Tamah & Fellowship',
    'ACARA',
    '00000000-0000-0000-0000-000000000009', -- Ruth
    '19:18:00',
    15,
    'PENDING',
    'BGM festive Christmas up-tempo, lighting color wash hangat',
    'Goodie bag snack Natal dibagikan di pintu keluar'
  )
ON CONFLICT (id) DO NOTHING;

-- 9.3 SAMPLE UPCOMING EVENT (READY-TO-TEST FOR PRE-EVENT & LIVE CONTROLLER)
INSERT INTO events (
  id,
  title,
  theme,
  event_date,
  status,
  time_tolerance_seconds,
  event_leader_id,
  created_by
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Perayaan Natal Remaja & Pemuda 2026',
  'The Light of Hope in Darkness (Yesaya 9:2)',
  CURRENT_DATE + INTERVAL '14 days',
  'PRE_EVENT',
  60,
  '00000000-0000-0000-0000-000000000005', -- Kevin Pratama (Event Leader)
  '00000000-0000-0000-0000-000000000001'  -- Daniel Wicaksono (Created By)
) ON CONFLICT (id) DO NOTHING;

-- 9.4 EVENT ROSTER ASSIGNMENTS FOR SAMPLE EVENT
INSERT INTO event_roster (
  id,
  event_id,
  user_id,
  section,
  role_in_event,
  is_co_controller
) VALUES
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'ACARA', 'EVENT_LEADER', false),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'INTI', 'CO_CONTROLLER', true),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'INTI', 'CO_CONTROLLER', true),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'INTI', 'MEMBER', false),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'INTI', 'MEMBER', false),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'DEKORASI', 'SECTION_LEADER', false),
  ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'PERLENGKAPAN', 'SECTION_LEADER', false),
  ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'PDD', 'SECTION_LEADER', false),
  ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'ACARA', 'MEMBER', false),
  ('21000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'PERLENGKAPAN', 'MEMBER', false),
  ('21000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'PDD', 'MEMBER', false),
  ('21000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'DEKORASI', 'MEMBER', false)
ON CONFLICT (event_id, user_id, section) DO NOTHING;

-- 9.5 ATTACH ACTIVE RUNDOWN FOR SAMPLE EVENT
INSERT INTO rundowns (
  id,
  event_id,
  name,
  is_template
) VALUES (
  '22000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Rundown Hari-H Natal 2026',
  false
) ON CONFLICT (id) DO NOTHING;

-- Items for Event Rundown
INSERT INTO rundown_items (
  id,
  rundown_id,
  order_index,
  title,
  section_pic,
  pic_user_id,
  planned_start_time,
  estimated_duration_minutes,
  status,
  technical_notes,
  cue_props
) VALUES
  ('23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 1, 'Open Gate & Registrasi Jemaat', 'ACARA', '00000000-0000-0000-0000-000000000009', '17:00:00', 15, 'PENDING', 'Pintu utama dibuka, background music akustik', 'Buku warta, barcode souvenir'),
  ('23000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000001', 2, 'Countdown & Video Teaser', 'PDD', '00000000-0000-0000-0000-000000000008', '17:15:00', 3, 'PENDING', 'Blackout lampu aula, audio video -3dB', 'File video teaser Natal'),
  ('23000000-0000-0000-0000-000000000003', '22000000-0000-0000-0000-000000000001', 3, 'Praise & Worship', 'ACARA', '00000000-0000-0000-0000-000000000005', '17:18:00', 25, 'PENDING', 'Lighting dinamis cerah, lirik slide LED', 'Wireless mic 3 unit'),
  ('23000000-0000-0000-0000-000000000004', '22000000-0000-0000-0000-000000000001', 4, 'Doa Pembukaan', 'INTI', '00000000-0000-0000-0000-000000000001', '17:43:00', 5, 'PENDING', 'Spotlight podium', 'Mic podium'),
  ('23000000-0000-0000-0000-000000000005', '22000000-0000-0000-0000-000000000001', 5, 'Penampilan Drama Teatrikal', 'ACARA', '00000000-0000-0000-0000-000000000009', '17:48:00', 20, 'PENDING', 'Fog machine scene 2', 'Kostum drama & clip-on'),
  ('23000000-0000-0000-0000-000000000006', '22000000-0000-0000-0000-000000000001', 6, 'Khotbah Firman Tuhan', 'INTI', '00000000-0000-0000-0000-000000000002', '18:08:00', 35, 'PENDING', 'Warm white static, mic clip-on pembicara', 'Alkitab & monitor lantai'),
  ('23000000-0000-0000-0000-000000000007', '22000000-0000-0000-0000-000000000001', 7, 'Candle Light Service', 'ACARA', '00000000-0000-0000-0000-000000000005', '18:43:00', 15, 'PENDING', 'Padam total, spotlight lilin induk', 'Lilin jemaat & pemantik'),
  ('23000000-0000-0000-0000-000000000008', '22000000-0000-0000-0000-000000000001', 8, 'Doa Berkat & Persembahan', 'INTI', '00000000-0000-0000-0000-000000000004', '18:58:00', 10, 'PENDING', 'Musik lembut, QRIS persembahan di layar', 'Kantong persembahan'),
  ('23000000-0000-0000-0000-000000000009', '22000000-0000-0000-0000-000000000001', 9, 'Pengumuman & Foto Bersama', 'PDD', '00000000-0000-0000-0000-000000000011', '19:08:00', 10, 'PENDING', 'Lampu hall terang penuh', 'Kamera wide angle'),
  ('23000000-0000-0000-0000-000000000010', '22000000-0000-0000-0000-000000000001', 10, 'Closing & Ramah Tamah', 'ACARA', '00000000-0000-0000-0000-000000000009', '19:18:00', 15, 'PENDING', 'Lagu Natal ceria', 'Bingkisan Natal')
ON CONFLICT (id) DO NOTHING;

-- 9.6 SAMPLE PRE-EVENT TIMELINE TASKS
INSERT INTO timeline_tasks (
  id,
  event_id,
  section,
  phase,
  title,
  description,
  assigned_to,
  due_date,
  status
) VALUES
  (
    '24000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'DEKORASI',
    'PRE_EVENT',
    'Finalisasi Pohon Natal & Backdrop Panggung',
    'Merakit pohon cemara 4 meter dan memasang fairy lights kelap-kelip',
    '00000000-0000-0000-0000-000000000006', -- Clarissa
    CURRENT_DATE + INTERVAL '5 days',
    'IN_PROGRESS'
  ),
  (
    '24000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'PERLENGKAPAN',
    'PRE_EVENT',
    'Sewa Tambahan 4 Unit Wireless Microphone',
    'Menghubungi vendor rental audio untuk mic Shure GLXD4',
    '00000000-0000-0000-0000-000000000007', -- Michael
    CURRENT_DATE + INTERVAL '7 days',
    'DONE'
  ),
  (
    '24000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'PDD',
    'PRE_EVENT',
    'Rendering Video Teaser Natal 4K',
    'Menyelesaikan grading warna dan audio mixing opening countdown',
    '00000000-0000-0000-0000-000000000008', -- Andrew
    CURRENT_DATE + INTERVAL '10 days',
    'TODO'
  )
ON CONFLICT (id) DO NOTHING;

-- 9.7 SAMPLE BUDGET LEDGER ENTRIES
INSERT INTO event_budget_ledger (
  id,
  event_id,
  section,
  item_name,
  estimated_amount,
  actual_amount,
  notes
) VALUES
  ('25000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'DEKORASI', 'Ornamen Bintang, Bola & Lampu LED', 2500000.00, 2400000.00, 'Toko Surya Abadi Glodok'),
  ('25000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'PERLENGKAPAN', 'Sewa Wireless Mic & Fog Liquid', 1800000.00, 1800000.00, 'Vendor Soundtrack Rent'),
  ('25000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'ACARA', 'Lilin Jemaat 500 pcs & Pemantik', 600000.00, 550000.00, 'Grosir Lilin Pasar Baru')
ON CONFLICT (id) DO NOTHING;

-- 9.8 SAMPLE TECHNICAL GUIDES (SMART CUE CARDS)
INSERT INTO event_technical_guides (
  id,
  event_id,
  category,
  title,
  instructions_markdown,
  layout_image_url,
  target_sections
) VALUES (
  '26000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'CANDLE_LIGHT',
  'Prosedur Penyalaan Lilin Malam Kudus',
  E'### Petunjuk Alur Lilin Malam Kudus:\n1. Tepat pada bait 1 lagu "Malam Kudus", tim Lighting memadamkan lampu aula bertahap (10 detik fade-out).\n2. Pembicara mengambil api dari lilin induk di mimbar utama.\n3. 10 Usher menyalakan lilin dari pembicara dan menyebar ke tiap baris lorong jemaat.\n4. **Penting**: Lilin yang diam diarahkan menerima api (jangan memiringkan lilin yang sudah menyala untuk mencegah lelehan wax ke jemaat).\n5. Selesai bait terakhir, tahan suasana hening selama 30 detik sebelum doa.',
  'https://images.unsplash.com/photo-1512474932049-78ac69eed10c?w=600',
  '{ACARA,PERLENGKAPAN,ALL}'
) ON CONFLICT (id) DO NOTHING;

-- 9.9 SAMPLE TOOLS INVENTORY CHECKLIST
INSERT INTO section_tools_inventory (
  id,
  event_id,
  tool_name,
  quantity,
  source,
  pic_user_id,
  is_ready,
  notes
) VALUES
  ('27000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Wireless Mic Shure GLXD4', 4, 'RENTAL', '00000000-0000-0000-0000-000000000010', true, 'Frekuensi channel sudah di-scan bebas interferensi'),
  ('27000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Heavy Fog Smoke Machine 1500W', 2, 'IN_HOUSE', '00000000-0000-0000-0000-000000000007', true, 'Liquid smoke terisi penuh'),
  ('27000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Pointer Clicker Logitech R800', 2, 'IN_HOUSE', '00000000-0000-0000-0000-000000000010', false, 'Baterai AAA perlu diganti')
ON CONFLICT (id) DO NOTHING;

-- 9.10 SAMPLE PDD SHOTLIST
INSERT INTO section_pdd_shotlist (
  id,
  event_id,
  scene_title,
  shot_type,
  camera_angle,
  pic_user_id,
  status,
  drive_link
) VALUES
  ('28000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Ekspresi Jemaat saat Candle Light', 'PHOTO', 'Close-up bokeh lilin di tangan jemaat', '00000000-0000-0000-0000-000000000008', 'PENDING', NULL),
  ('28000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Highlight Drama Teatrikal', 'VIDEO', 'Gimbal tracking shot dari sayap kiri panggung', '00000000-0000-0000-0000-000000000011', 'PENDING', NULL)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- END OF CHURCH CREATIVE TEAM EVENT OS SCHEMA
-- ==============================================================================


-- ============================================================================
-- TAHAP B: Idempotency, Notifications, PDD References, Roster Uniqueness & RPCs
-- ============================================================================

CREATE TABLE IF NOT EXISTS operation_records (
  operation_id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdd_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  description TEXT,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_roster
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_active_event_leader
  ON event_roster (event_id)
  WHERE role_in_event = 'EVENT_LEADER' AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_active_section_leader
  ON event_roster (event_id, section)
  WHERE role_in_event = 'SECTION_LEADER' AND is_active = TRUE;

CREATE OR REPLACE FUNCTION skip_segment_atomic(
  p_event_id UUID,
  p_current_item_id UUID,
  p_next_item_id UUID,
  p_operation_id UUID,
  p_actor_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM operation_records WHERE operation_id = p_operation_id) THEN
    RETURN;
  END IF;

  INSERT INTO operation_records (operation_id, event_id, action_type, actor_id)
  VALUES (p_operation_id, p_event_id, 'SKIP_SEGMENT', p_actor_id);

  PERFORM 1 FROM events WHERE id = p_event_id FOR UPDATE;

  UPDATE rundown_items
  SET status = 'SKIPPED', actual_start_at = NULL, actual_end_at = NULL
  WHERE id = p_current_item_id;

  UPDATE rundown_items
  SET status = 'ACTIVE', actual_start_at = NOW()
  WHERE id = p_next_item_id;

  UPDATE events
  SET current_item_id = p_next_item_id, current_item_started_at = NOW(), updated_at = NOW()
  WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION change_queue_atomic(
  p_event_id UUID,
  p_moved_item_id UUID,
  p_new_order_index INT,
  p_operation_id UUID,
  p_actor_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM operation_records WHERE operation_id = p_operation_id) THEN
    RETURN;
  END IF;

  INSERT INTO operation_records (operation_id, event_id, action_type, actor_id)
  VALUES (p_operation_id, p_event_id, 'CHANGE_QUEUE', p_actor_id);

  PERFORM 1 FROM rundown_items WHERE id = p_moved_item_id FOR UPDATE;

  UPDATE rundown_items
  SET order_index = p_new_order_index
  WHERE id = p_moved_item_id;
END;
$$;
