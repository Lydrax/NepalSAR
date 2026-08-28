import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Supabase admin configuration', () => {
  it('does not create placeholder clients when credentials are missing', () => {
    const adminPath = path.resolve(__dirname, '../src/lib/supabase/admin.ts');
    const source = fs.readFileSync(adminPath, 'utf8');

    expect(source).toContain('SupabaseConfigError');
    expect(source).not.toContain('placeholder.supabase.co');
    expect(source).not.toContain('placeholder-service-role-key');
  });

  it('keeps the service role key out of public environment variables', () => {
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    const envContent = fs.readFileSync(envExamplePath, 'utf8');

    expect(envContent).toContain('SUPABASE_SERVICE_ROLE_KEY=');
    expect(envContent).not.toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    expect(envContent).toContain('Never expose to client');
  });
});
