-- ==============================================================================
-- NEPAL RESCUE PLATFORM — PURGE TEST & DUMMY DATA RPC
-- Migration: 20260828000004_purge_dummy_data_rpc.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION purge_all_rescue_requests()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Disable trigger temporarily during admin purge
  ALTER TABLE rescue_request_events DISABLE TRIGGER trg_prevent_audit_update_delete;

  DELETE FROM rescue_request_access;
  DELETE FROM rescue_request_photos;
  DELETE FROM rescue_request_events;
  DELETE FROM rescue_requests;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Re-enable immutable audit trigger
  ALTER TABLE rescue_request_events ENABLE TRIGGER trg_prevent_audit_update_delete;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
