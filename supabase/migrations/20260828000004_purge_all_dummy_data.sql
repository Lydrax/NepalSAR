-- ==============================================================================
-- NEPAL RESCUE PLATFORM — PURGE ALL DUMMY & TEST RESCUE RECORDS
-- Run this in your Supabase SQL Editor to wipe all dummy data cleanly
-- ==============================================================================

-- 1. Temporarily disable the immutable audit trigger so cascading deletions succeed
ALTER TABLE rescue_request_events DISABLE TRIGGER trg_prevent_audit_update_delete;

-- 2. Delete all records across emergency data tables
DELETE FROM rescue_request_access;
DELETE FROM rescue_request_photos;
DELETE FROM rescue_request_events;
DELETE FROM rescue_requests;

-- 3. Re-enable the append-only immutable audit protection trigger
ALTER TABLE rescue_request_events ENABLE TRIGGER trg_prevent_audit_update_delete;

-- 4. Create reusable RPC for future administrative cleaning
CREATE OR REPLACE FUNCTION purge_all_rescue_requests()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  ALTER TABLE rescue_request_events DISABLE TRIGGER trg_prevent_audit_update_delete;

  DELETE FROM rescue_request_access;
  DELETE FROM rescue_request_photos;
  DELETE FROM rescue_request_events;
  DELETE FROM rescue_requests;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  ALTER TABLE rescue_request_events ENABLE TRIGGER trg_prevent_audit_update_delete;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
