import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// users.phone is no longer bulk-readable; admins fetch it via an is_admin()-gated RPC.
// Returns a map of user_id -> phone for the given ids (empty for non-admins).
export async function adminPhones(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!uniq.length) return {};
  const { data } = await supabase.rpc('admin_user_phones', { p_ids: uniq });
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { if (r.phone) map[r.user_id] = r.phone; });
  return map;
}
