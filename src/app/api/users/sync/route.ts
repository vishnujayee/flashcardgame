// app/api/users/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserToMongoDB } from "@/lib/user-sync";

export async function POST(request: NextRequest) {
  try {
    const { supabaseUserId, email } = await request.json();
    
    if (!supabaseUserId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await syncUserToMongoDB(supabaseUserId, email);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("User sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}