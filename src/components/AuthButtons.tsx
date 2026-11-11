"use client";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export function LoginButton() {
	async function onLogin() {
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signInWithOAuth({ provider: "github" });
	}
	return (
		<button onClick={onLogin} className="px-4 py-2 bg-black text-white rounded">Sign in with GitHub</button>
	);
}

export function LogoutButton() {
	async function onLogout() {
		const supabase = getSupabaseBrowserClient();
		await supabase.auth.signOut();
		location.reload();
	}
	return (
		<button onClick={onLogout} className="px-3 py-2 border rounded">Sign out</button>
	);
}
