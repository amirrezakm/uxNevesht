import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
// Prefer service role key on the server if available for unrestricted server-side access
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
  throw new Error('Missing Supabase environment variables');
}

// Use service role key if present (server-side only); fall back to anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);