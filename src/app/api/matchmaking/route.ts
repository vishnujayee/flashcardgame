// app/api/matchmaking/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { StartMatchmakingInput } from "@/lib/schemas";
import { getMongoClient, getMongoDbName, ensureIndexes } from "@/lib/mongodb";
import { getActorIdOrGuest } from "@/lib/guest-session";
import { getClientIp } from "@/lib/request-helpers";
import { allowOncePerWindow } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import crypto from "crypto";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const actorId = await getActorIdOrGuest(user?.id ?? null);
    
    let body: any = {};
    try {
      body = await req.json();
    } catch {}
    
    const parsed = StartMatchmakingInput.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const envSizeRaw = Number(process.env.MATCH_SIZE);
    const envSize = Number.isFinite(envSizeRaw) ? envSizeRaw : NaN;
    const defaultCount = Number.isFinite(envSize) && envSize > 0
      ? Math.min(50, Math.max(1, envSize))
      : parsed.data.count;
    const desiredCount = typeof body?.count === "number"
      ? Math.min(50, Math.max(1, Math.floor(body.count)))
      : defaultCount;

    // Rate limiting
    const ip = getClientIp(req);
    const allowed = await allowOncePerWindow(`mm:${actorId}`, Number(process.env.RL_WINDOW_MS || 60000), Number(process.env.RL_MAX || 30));
    if (!allowed) return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });

    // DB interactions with better error handling
    let queue, matches, db;
    try {
      await ensureIndexes();
      const client = await getMongoClient();
      db = client.db(getMongoDbName());
      queue = db.collection("queue");
      matches = db.collection("matches");
    } catch (e: any) {
      console.error("MongoDB connection failed:", e);
      return NextResponse.json({ 
        error: "Database connection failed", 
        details: e.message 
      }, { status: 500 });
    }

    // Prevent duplicate active matches
    const inActiveMatch = await matches.findOne({ 
      status: "active", 
      "players.userId": actorId 
    });
    
    if (inActiveMatch) {
      return NextResponse.json({ 
        error: "Already in active match", 
        matchId: String(inActiveMatch._id) 
      }, { status: 409 });
    }

    // Ensure single queue entry per user
    try {
      await queue.updateOne(
        { userId: actorId },
        { $set: { createdAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      console.error("Queue update error:", error);
    }

    // Replace the entire matchmaking logic after the queue operations with this:

// Try to pair with someone else - FIXED ORDER
const sameIpBlock = String(process.env.BLOCK_SAME_IP || "false").toLowerCase() === "true";
const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : undefined;

if (ipHash) {
  try {
    await queue.updateOne({ userId: actorId }, { $set: { ipHash } });
  } catch (error) {
    console.error("IP hash update error:", error);
  }
}

// DEBUG: Log current queue state
const currentQueue = await queue.find().toArray();
console.log("🔍 Current queue:", currentQueue.map(q => ({
  userId: q.userId,
  isGuest: q.userId.startsWith('guest_'),
  ipHash: q.ipHash ? 'hashed' : 'none'
})));

const session = (await getMongoClient()).startSession();
let partner = null;

try {
  await session.withTransaction(async () => {
    const partnerResult = await queue.findOneAndDelete(
      {
        userId: { $ne: actorId },
        ...(sameIpBlock && ipHash ? { 
          $or: [
            { ipHash: { $ne: ipHash } },
            { ipHash: ipHash, userId: { $regex: /^guest_/ } }
          ]
        } : {})
      },
      { session }
    );

    if (!partnerResult.value) {
      // No partner found, queue ourselves
      await queue.updateOne(
        { userId: actorId },
        { $set: { createdAt: new Date(), ipHash } },
        { upsert: true, session }
      );
      throw new Error('NO_PARTNER'); // This will rollback the transaction
    }

    partner = partnerResult.value;
    
    // Remove ourselves from queue
    await queue.deleteOne({ userId: actorId }, { session });
  });
} catch (error: any) {
  if (error.message === 'NO_PARTNER') {
    // Notify queued status
    try {
      const admin = getSupabaseAdminClient();
      await admin.channel(`mm:${actorId}`).send({ 
        type: "broadcast", 
        event: "matchmaking:queued", 
        payload: { actorId } 
      });
    } catch (broadcastError) {
      console.error("Broadcast error:", broadcastError);
    }
    return NextResponse.json({ status: "queued" });
  }
  throw error;
}

// If we reach here, we found a partner!
console.log(" Match found! Partner:", partner.userId);

// Sample cards
let sampleCards;
try {
  sampleCards = await db
    .collection("flashcards")
    .aggregate([{ $sample: { size: desiredCount } }, { $project: { _id: 1 } }])
    .toArray();
} catch (error) {
  console.error("Flashcard sampling error:", error);
  return NextResponse.json({ error: "Failed to sample flashcards" }, { status: 500 });
}

if (sampleCards.length === 0) {
  return NextResponse.json({ error: "No flashcards available" }, { status: 400 });
}

const flashcardIds = sampleCards.map((d) => String(d._id));
const doc = {
  status: "active",
  players: [
    { userId: partner.userId, score: 0 }, 
    { userId: actorId, score: 0 }
  ],
  flashcardIds,
  currentCardIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let result;
try {
  result = await matches.insertOne(doc);
} catch (error) {
  console.error("Match insert error:", error);
  return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
}

// Broadcast match to both users with retry logic
const broadcastMatch = async (userId: string, matchId: string) => {
  try {
    const admin = getSupabaseAdminClient();
    await admin.channel(`mm:${userId}`).send({ 
      type: "broadcast", 
      event: "matchmaking:matched", 
      payload: { matchId } 
    });
  } catch (error) {
    console.error(`Broadcast failed for ${userId}:`, error);
    // Retry after 1 second
    setTimeout(() => broadcastMatch(userId, matchId), 1000);
  }
};

// Broadcast to both players
await Promise.allSettled([
  broadcastMatch(partner.userId, String(result.insertedId)),
  broadcastMatch(actorId, String(result.insertedId))
]);

console.log("✅ Match created successfully:", String(result.insertedId));

return NextResponse.json({ 
  status: "matched", 
  matchId: String(result.insertedId) 
}, { status: 201 });

  } catch (error: any) {
    console.error("Unexpected error in matchmaking:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error.message 
    }, { status: 500 });
  }
}