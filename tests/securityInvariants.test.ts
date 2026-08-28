import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Security & Privacy Invariants', () => {
  it('verifies that SQL migration contains strict RLS policies blocking anonymous access', () => {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260827000001_initial_schema.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // 1. RLS must be enabled on all tables
    expect(sqlContent).toContain('ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;');
    expect(sqlContent).toContain('ALTER TABLE rescue_requests ENABLE ROW LEVEL SECURITY;');
    expect(sqlContent).toContain('ALTER TABLE rescue_request_access ENABLE ROW LEVEL SECURITY;');
    expect(sqlContent).toContain('ALTER TABLE rescue_request_events ENABLE ROW LEVEL SECURITY;');
    expect(sqlContent).toContain('ALTER TABLE rescue_request_photos ENABLE ROW LEVEL SECURITY;');

    // 2. Select permitted only for verified responders
    expect(sqlContent).toContain('CREATE POLICY "Responders can select rescue requests"');
    expect(sqlContent).toContain('USING (is_responder());');

    // 3. Audit trail immutability trigger exists
    expect(sqlContent).toContain('CREATE TRIGGER trg_prevent_audit_update_delete');
    expect(sqlContent).toContain('BEFORE UPDATE OR DELETE ON rescue_request_events');

    // 4. Token hash length constraint exists (64-char SHA-256)
    expect(sqlContent).toContain('CHECK (char_length(token_hash) = 64)');
  });

  it('verifies that .env.example does not leak default service role secrets and documents SERVER ONLY', () => {
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    const envContent = fs.readFileSync(envExamplePath, 'utf8');

    expect(envContent).toContain('SUPABASE_SERVICE_ROLE_KEY=');
    expect(envContent).toContain('Never expose to client');
  });

  it('verifies that .gitignore includes all local env files', () => {
    const gitignorePath = path.resolve(__dirname, '../.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

    expect(gitignoreContent).toContain('.env*.local');
    expect(gitignoreContent).toContain('.env');
  });
});
