import { createClient } from "@supabase/supabase-js";

export function getSupabaseBrowserClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anon) throw new Error("Supabase env not set");
	return createClient(url, anon, { auth: { persistSession: true } });
}
