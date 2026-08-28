import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl && typeof window !== 'undefined') {
  console.warn('NEXT_PUBLIC_SUPABASE_URL is missing. Check your environment configuration.');
}

/**
 * Public client for client-side queries (RLS enforced).
 * Safe for use in browser components.
 */
export const supabaseBrowser = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
