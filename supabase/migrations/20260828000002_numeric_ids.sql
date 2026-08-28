-- ==============================================================================
-- NEPAL RESCUE PLATFORM — NUMERIC CASE ID & SIMPLIFIED VERIFICATION PIN
-- Migration: 20260828000002_numeric_ids.sql
-- Description: Updates case number sequence to pure numeric digits without hyphens (YYYYXXXXXX)
--              and supports 6-digit numeric verification PINs for easy recall.
-- ==============================================================================

CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_val BIGINT;
  formatted_case TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  next_val := nextval('case_number_seq');
  -- Format: YYYYXXXXXX (10-digit clean number without hyphens, e.g. 2026000015)
  formatted_case := current_year || LPAD(next_val::TEXT, 6, '0');
  RETURN formatted_case;
END;
$$ LANGUAGE plpgsql;
