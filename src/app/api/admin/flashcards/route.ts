import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { CreateFlashcardInput } from "@/lib/schemas";
import { getMongoClient, getMongoDbName } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
	try {
		const supabase = await getSupabaseServerClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const allow = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
		if (!allow.includes(user.email || "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

		const body = await req.json();
		const parsed = CreateFlashcardInput.safeParse(body);
		if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

		const client = await getMongoClient();
		const db = client.db(getMongoDbName());
		const doc = {
			question: parsed.data.question,
			answer: parsed.data.answer,
			createdBy: user.id,
			createdAt: new Date(),
		};
		const result = await db.collection("flashcards").insertOne(doc);
		return NextResponse.json({ id: String(result.insertedId) }, { status: 201 });
	} catch (err: any) {
		return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
	}
}
