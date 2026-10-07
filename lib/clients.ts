/**
 * =============================================================================
 * Project: IqwanEngine (IE) - Client Data Controller
 * Author: Iqwan (OWLFX)
 * Coded, Refactored & Secured by: IqwanEngine
 * =============================================================================
 */

import { supabase } from './supabase';

export interface VIPClient {
  id: number;
  trader_name: string;
  contact_number: string;
  register_email: string;
  trading_view_username: string;
  valetax_id: string;
  register_date: string;
  service_days: string;
  updated_by: string;
  level: string;
  direct_partner_email: string;
  balance: string;
  equity: string;
  credit: string;
  margin: string;
  leverage: string;
  account_name: string;
  account_type: string;
  server: string;
  platform: string;
  date_of_creation: string;
  currency: string;
  status: string;
  last_update: string;
  update_balanced?: string;
  created_at?: string;
}

/**
 * Tarik semua senarai klien VIP dari Supabase dengan susunan ID terkini
 */
export async function getVIPClients(): Promise<VIPClient[]> {
  try {
    const { data, error } = await supabase
      .from('vip_clients')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('[IqwanEngine] Gagal memuat turun data dari Supabase:', error.message);
      return [];
    }

    return (data as VIPClient[]) || [];
  } catch (err) {
    console.error('[IqwanEngine] Ralat kritikal fetch clients:', err);
    return [];
  }
}
