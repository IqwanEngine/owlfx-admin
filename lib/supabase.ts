/**
 * =============================================================================
 * Project: IqwanEngine (IE) - Database Client Connection
 * Author: Iqwan (OWLFX)
 * Coded, Refactored & Secured by: IqwanEngine
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Inisialisasi sambungan selamat berasaskan Environment Variable
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
