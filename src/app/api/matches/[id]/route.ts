import { NextResponse } from "next/server";
import { getMongoClient, getMongoDbName, ensureIndexes } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getActorIdOrGuest } from "@/lib/guest-session";

export async function GET(req: Request, { params }: { params: { id: string } }) {
	const supabase = await getSupabaseServerClient();
	const { data: { user } } = await supabase.auth.getUser();
	const actorId = await getActorIdOrGuest(user?.id ?? null);
	await ensureIndexes();
	const client = await getMongoClient();
	const db = client.db(getMongoDbName());
	if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: "Bad Request" }, { status: 400 });
	const match = await db.collection("matches").findOne({ _id: new ObjectId(params.id), "players.userId": actorId });
	if (!match) return NextResponse.json({ error: "Not Found" }, { status: 404 });
	return NextResponse.json({ match });
}
