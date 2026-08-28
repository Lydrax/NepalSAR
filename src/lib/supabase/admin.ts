import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

// Runtime safety barrier against client-side execution
if (typeof window !== 'undefined') {
  throw new Error(
    'CRITICAL SECURITY VIOLATION: src/lib/supabase/admin.ts is server-only and must NEVER be imported in client components.'
  );
}

let adminClientInstance: SupabaseClient<Database> | null = null;

export class SupabaseConfigError extends Error {
  constructor(
    message = 'Server configuration error: Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (service role key must never be exposed to the client).'
  ) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

function requireAdminCredentials(): { supabaseUrl: string; serviceRoleKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new SupabaseConfigError();
  }

  return { supabaseUrl, serviceRoleKey };
}

/**
 * Returns a privileged Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * STRICTLY SERVER-ONLY.
 * Used for server-side verification, sequence generation, atomic audit logs, and rate-limiting.
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: Admin client attempted to execute in browser context.');
  }

  const { supabaseUrl, serviceRoleKey } = requireAdminCredentials();

  if (!adminClientInstance) {
    adminClientInstance = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClientInstance;
}
