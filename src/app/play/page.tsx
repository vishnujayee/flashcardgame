"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { announce } from "@/components/LiveRegion";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export default function PlayPage() {
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const channelRef = useRef<ReturnType<typeof getSupabaseBrowserClient>["channel"] | null>(null as any);

	useEffect(() => {
		return () => {
			try {
				const supabase = getSupabaseBrowserClient();
				if (channelRef.current) supabase.removeChannel(channelRef.current as any);
			} catch {}
		};
	}, []);

	async function findMatch() {
		setLoading(true);
		setStatus(null);
		try {
			const res = await fetch("/api/matchmaking", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			const data = await res.json();
			if (data.status === "queued") {
				setStatus("Searching for opponent…");
				announce("Searching for opponent");
				const supabase = getSupabaseBrowserClient();
				const actorResp = await fetch("/api/actor", { cache: "no-store" });
				const actorJson = await actorResp.json();
				const actorId = actorJson.actorId || "guest";
				// Subscribe to personal matchmaking channel
				const channel = supabase.channel(`mm:${actorId || "guest"}`);
				channel.on("broadcast", { event: "matchmaking:matched" }, (payload) => {
					const mid = (payload as any).payload?.matchId;
					if (mid) {
						announce("Match found. Opening match.");
						router.push(`/match/${mid}`);
					}
				});
				channel.subscribe();
				channelRef.current = channel as any;
			} else if (data.status === "matched") {
				router.push(`/match/${data.matchId}`);
			} else {
				throw new Error(data.error || "Failed to queue");
			}
		} catch (e: any) {
			setStatus(e.message || "Error finding match");
			announce("Error finding match");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-md mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-bold">Find a Match</h1>
			<p className="text-sm text-gray-600">Click below and well match you automatically.</p>
			<button onClick={findMatch} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 w-full">{loading ? "Finding…" : "Find Match"}</button>
			{status && <p className="text-sm text-gray-600" aria-live="polite">{status}</p>}
		</div>
	);
}
