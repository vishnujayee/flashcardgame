import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSupabaseServerClient() {
	const cookieStore = await cookies();
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
	const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
	if (!url || !anon) throw new Error("Supabase env not set");
	return createServerClient(url, anon, {
		cookies: {
			get(name: string) {
				return cookieStore.get(name)?.value;
			},
			set(name: string, value: string, options: any) {
				try {
					cookieStore.set({ name, value, ...options });
				} catch {}
			},
			remove(name: string, options: any) {
				try {
					cookieStore.set({ name, value: "", ...options });
				} catch {}
			},
		},
	});
}
