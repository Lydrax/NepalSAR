import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CASE_NUMBER_PATTERN = /^NR-\d{4}-\d{6}$/;

describe('Database-backed case number generation', () => {
  it('migration defines sequence, generator function, and column DEFAULT', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20260827000001_initial_schema.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    expect(sqlContent).toContain('CREATE SEQUENCE IF NOT EXISTS case_number_seq');
    expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION generate_case_number()');
    expect(sqlContent).toContain('nextval(\'case_number_seq\')');
    expect(sqlContent).toContain("DEFAULT generate_case_number()");
    expect(sqlContent).toMatch(/LPAD\(next_val::TEXT,\s*6,\s*'0'\)/);
  });

  it('submit API relies on database DEFAULT instead of client-side generation', () => {
    const submitRoutePath = path.resolve(__dirname, '../src/app/api/rescue/submit/route.ts');
    const source = fs.readFileSync(submitRoutePath, 'utf8');

    expect(source).not.toContain('Math.random');
    expect(source).not.toMatch(/case_number:\s*caseNumber/);
    expect(source).not.toMatch(/case_number:\s*`NR-/);
    expect(source).toContain('DEFAULT generate_case_number()');
  });

  it('documents the NR-YYYY-XXXXXX format produced by the database function', () => {
    const year = new Date().getFullYear();
    const examples = [`NR-${year}-000001`, `NR-${year}-000184`, `NR-${year}-999999`];

    examples.forEach((example) => {
      expect(CASE_NUMBER_PATTERN.test(example)).toBe(true);
    });
  });
});
