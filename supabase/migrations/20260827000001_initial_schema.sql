-- ==============================================================================
-- NEPAL RESCUE PLATFORM — INITIAL DATABASE SCHEMA MIGRATION
-- Migration: 20260827000001_initial_schema.sql
-- Description: Core schema, enums, collision-resistant case number generator,
--              audit events, private access tokens, and strict RLS policies.
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUMS
CREATE TYPE responder_role AS ENUM ('RESPONDER', 'DISPATCHER', 'ADMIN');
CREATE TYPE rescue_priority AS ENUM ('CRITICAL', 'HIGH', 'NORMAL');
CREATE TYPE rescue_status AS ENUM (
  'SUBMITTED',
  'VERIFIED',
  'ASSIGNED',
  'RESCUER_EN_ROUTE',
  'RESCUED',
  'CLOSED',
  'CANCELLED'
);
CREATE TYPE immediate_danger AS ENUM (
  'trapped',
  'stranded',
  'evacuating',
  'injured_immobile',
  'safe_need_evac',
  'other'
);
CREATE TYPE injury_level AS ENUM ('none', 'minor', 'serious', 'critical');
CREATE TYPE disaster_type AS ENUM (
  'flood',
  'landslide',
  'earthquake',
  'building_collapse',
  'avalanche',
  'fire',
  'other'
);
CREATE TYPE location_source AS ENUM ('GPS', 'MAP', 'MANUAL');

-- 2. CASE NUMBER SEQUENCE GENERATOR
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_val BIGINT;
  formatted_case TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  next_val := nextval('case_number_seq');
  -- Format: NR-YYYY-XXXXXX (6-digit zero-padded sequence)
  formatted_case := 'NR-' || current_year || '-' || LPAD(next_val::TEXT, 6, '0');
  RETURN formatted_case;
END;
$$ LANGUAGE plpgsql;

-- 3. PROFILES TABLE (Verified SAR Responders & Dispatchers)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) > 0),
  organization TEXT,
  role responder_role NOT NULL DEFAULT 'RESPONDER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RESCUE REQUESTS TABLE
CREATE TABLE rescue_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE DEFAULT generate_case_number(),
  client_request_id UUID NOT NULL UNIQUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Location Information
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)),
  location_accuracy DOUBLE PRECISION CHECK (location_accuracy IS NULL OR location_accuracy >= 0),
  location_timestamp TIMESTAMPTZ,
  location_source location_source NOT NULL DEFAULT 'GPS',
  manual_location_description TEXT CHECK (manual_location_description IS NULL OR char_length(manual_location_description) <= 1000),
  
  -- Emergency Situation Information
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count >= 1 AND people_count <= 100),
  trapped_status immediate_danger NOT NULL,
  injury_level injury_level NOT NULL,
  disaster_type disaster_type NOT NULL,
  disaster_other TEXT CHECK (disaster_other IS NULL OR char_length(disaster_other) <= 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  
  -- Contact & Responder Assignment
  phone_number TEXT CHECK (phone_number IS NULL OR char_length(phone_number) <= 30),
  priority rescue_priority NOT NULL,
  status rescue_status NOT NULL DEFAULT 'SUBMITTED',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraint: Must provide either valid coordinates or a manual description
  CONSTRAINT chk_location_provided CHECK (
    (latitude IS NOT NULL AND longitude IS NOT NULL) OR
    (manual_location_description IS NOT NULL AND length(trim(manual_location_description)) > 0)
  )
);

-- 5. RESCUE REQUEST ACCESS (Dual-Credential Verification Token Hashes)
CREATE TABLE rescue_request_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_request_id UUID NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE UNIQUE,
  token_hash TEXT NOT NULL CHECK (char_length(token_hash) = 64), -- SHA-256 hex string
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. RESCUE REQUEST EVENTS (Append-Only Operational Audit Trail)
CREATE TABLE rescue_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_request_id UUID NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  old_status rescue_status,
  new_status rescue_status,
  notes TEXT
);

-- 7. RESCUE REQUEST PHOTOS (Private Evidence Metadata)
CREATE TABLE rescue_request_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_request_id UUID NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 8. INDEXES FOR HIGH-THROUGHPUT OPERATIONAL ACCESS
CREATE INDEX idx_rescue_requests_case_number ON rescue_requests(case_number);
CREATE INDEX idx_rescue_requests_client_id ON rescue_requests(client_request_id);
CREATE INDEX idx_rescue_requests_status ON rescue_requests(status);
CREATE INDEX idx_rescue_requests_priority_created ON rescue_requests(priority, created_at ASC);
CREATE INDEX idx_rescue_requests_assigned ON rescue_requests(assigned_to);
CREATE INDEX idx_rescue_request_events_req_id ON rescue_request_events(rescue_request_id, created_at ASC);
CREATE INDEX idx_rescue_request_access_hash ON rescue_request_access(token_hash);
CREATE INDEX idx_rescue_request_photos_req ON rescue_request_photos(rescue_request_id);

-- 9. TRIGGERS: AUTOMATIC UPDATED_AT & IMMUTABLE AUDIT LOGS
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_rescue_requests_updated_at
  BEFORE UPDATE ON rescue_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();

-- Guarantee that audit log entries can never be modified or deleted
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: rescue_request_events records are append-only and cannot be altered or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_update_delete
  BEFORE UPDATE OR DELETE ON rescue_request_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rescue_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rescue_request_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE rescue_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rescue_request_photos ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION is_responder()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('RESPONDER', 'DISPATCHER', 'ADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_dispatcher_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('DISPATCHER', 'ADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS POLICIES FOR PROFILES
-- Responders can view responder profiles
CREATE POLICY "Responders can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_responder());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Only admins can insert or delete profiles (no public self-registration)
CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS POLICIES FOR RESCUE_REQUESTS
-- Public/Anon cannot SELECT or list any rescue requests directly.
-- Authenticated responders can SELECT operational requests.
CREATE POLICY "Responders can select rescue requests"
  ON rescue_requests FOR SELECT
  TO authenticated
  USING (is_responder());

-- Responders can update operational fields
CREATE POLICY "Responders can update rescue requests"
  ON rescue_requests FOR UPDATE
  TO authenticated
  USING (is_responder())
  WITH CHECK (is_responder());

-- Anonymous/direct client INSERTs are blocked (Public submissions go exclusively through validated server API)
-- Authenticated responders can also insert if performing call-center intakes
CREATE POLICY "Authorized responders can insert rescue requests"
  ON rescue_requests FOR INSERT
  TO authenticated
  WITH CHECK (is_responder());

-- Disallow DELETE completely
-- (No DELETE policy defined -> PostgreSQL denies all DELETEs for non-superusers)

-- RLS POLICIES FOR RESCUE_REQUEST_ACCESS
-- Strictly server-only. No direct access for public or authenticated roles.
-- Service role bypasses RLS on server endpoints.

-- RLS POLICIES FOR RESCUE_REQUEST_EVENTS
-- Responders can read audit events
CREATE POLICY "Responders can view audit events"
  ON rescue_request_events FOR SELECT
  TO authenticated
  USING (is_responder());

-- Responders can append audit events
CREATE POLICY "Responders can append audit events"
  ON rescue_request_events FOR INSERT
  TO authenticated
  WITH CHECK (is_responder());

-- RLS POLICIES FOR RESCUE_REQUEST_PHOTOS
CREATE POLICY "Responders can view photo records"
  ON rescue_request_photos FOR SELECT
  TO authenticated
  USING (is_responder());

CREATE POLICY "Responders can insert photo records"
  ON rescue_request_photos FOR INSERT
  TO authenticated
  WITH CHECK (is_responder());

-- 11. PRIVATE STORAGE BUCKET CONFIGURATION
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rescue-photos',
  'rescue-photos',
  false,
  10485760, -- 10MB limit per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Responders only for read/write
CREATE POLICY "Responders can read rescue photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'rescue-photos' AND is_responder());

CREATE POLICY "Responders can upload rescue photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'rescue-photos' AND is_responder());
