"use client";
import { useState } from "react";
import { announce } from "@/components/LiveRegion";

export default function AdminFlashcardForm() {
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/admin/flashcards", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question, answer }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed");
			setQuestion("");
			setAnswer("");
			announce("Flashcard created");
		} catch (err: any) {
			setError(err.message);
			announce("Error creating flashcard");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-3">
			<div>
				<label className="block text-sm font-medium">Question</label>
				<input value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full border px-3 py-2 rounded" required />
			</div>
			<div>
				<label className="block text-sm font-medium">Answer</label>
				<input value={answer} onChange={(e) => setAnswer(e.target.value)} className="w-full border px-3 py-2 rounded" required />
			</div>
			<div className="flex items-center gap-2">
				<button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{loading ? "Creating..." : "Create"}</button>
				{error && <p className="text-red-600 text-sm">{error}</p>}
			</div>
		</form>
	);
}
