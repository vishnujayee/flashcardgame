import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
	if (cached) return cached;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
	if (!url || !serviceKey) throw new Error("Supabase admin env not set");
	cached = createClient(url, serviceKey, { auth: { persistSession: false } });
	return cached;
}
