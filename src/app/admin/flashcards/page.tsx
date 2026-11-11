import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import AdminFlashcardForm from "./ui/AdminFlashcardForm";

export default async function AdminFlashcardsPage() {
	const supabase = await getSupabaseServerClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/");
	const allow = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
	if (!allow.includes(user.email || "")) redirect("/");
	return (
		<div className="max-w-xl mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-bold">Create Flashcard</h1>
			<AdminFlashcardForm />
		</div>
	);
}
