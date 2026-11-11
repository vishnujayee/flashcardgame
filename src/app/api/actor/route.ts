// app/api/actor/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getActorIdOrGuest } from "@/lib/guest-session";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const actorId = await getActorIdOrGuest(user?.id ?? null);
  return NextResponse.json({ actorId });
}


