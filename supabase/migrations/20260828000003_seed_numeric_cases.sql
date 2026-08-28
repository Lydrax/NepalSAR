-- ==============================================================================
-- NEPAL RESCUE PLATFORM — NUMERIC SEED CASES & PIN VERIFICATION DATA
-- Migration: 20260828000003_seed_numeric_cases.sql
-- Description: Deletes legacy NR- prefixed records and creates initial operational
--              cases with numeric Case IDs and 6-digit verification PINs.
-- ==============================================================================

-- 1. Remove legacy cases with NR- prefix
DELETE FROM rescue_request_photos WHERE rescue_request_id IN (SELECT id FROM rescue_requests WHERE case_number LIKE 'NR-%');
DELETE FROM rescue_request_events WHERE rescue_request_id IN (SELECT id FROM rescue_requests WHERE case_number LIKE 'NR-%');
DELETE FROM rescue_request_access WHERE rescue_request_id IN (SELECT id FROM rescue_requests WHERE case_number LIKE 'NR-%');
DELETE FROM rescue_requests WHERE case_number LIKE 'NR-%';

-- 2. Create helper for seeding sample cases (if needed in SQL console)
-- SHA-256 for:
-- '112233' -> '287d3a03322bc6d7950c451db684acfe22a6136be4fbf4abff842d076ff4d84c'
-- '223344' -> '812cf9cfd658c740700d75c8087f4dbe35e5b209b534ec564d308212d22941fa'
-- '334455' -> '1f65bb5ec66c7b9576ef6a165fcb63d7e82ec52fe2126786c2dcf643f8e6c703'
-- '445566' -> '9c565d70b5dae8d249f3e498c48a803f271168f80459c381f9b3e157297e5558'
-- '556677' -> 'e030a597a78eb96b6d510fce9d3fe52e2be289139589d3119f074d2847a9feeb'
-- '667788' -> '066373b9e4a8ea4bcfcf35bbdb576a086b9777ebff3b3b24f52fdf3d75ea9c5f'
