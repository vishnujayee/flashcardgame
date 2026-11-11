// lib/rate-limit.ts
import crypto from "crypto";
import { getMongoClient, getMongoDbName } from "@/lib/mongodb";

export async function allowOncePerWindow(key: string, windowMs: number, max: number = 10): Promise<boolean> {
  try {
    const client = await getMongoClient();
    const db = client.db(getMongoDbName());
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    
    // Create a proper ID using the key and bucket
    const id = crypto.createHash("sha256").update(`${key}:${bucket}`).digest("hex");
    const coll = db.collection("ratelimits");
    
    const res = await coll.findOneAndUpdate(
      { _id: id }, // Use _id for the query, not key
      { 
        $inc: { count: 1 }, 
        $set: { 
          lastUpdated: new Date(now),
          key: key, // Store the original key for reference
          windowStart: new Date(bucket * windowMs),
          windowEnd: new Date((bucket + 1) * windowMs)
        },
        $setOnInsert: { 
          createdAt: new Date(now),
          bucket: bucket
        }
      },
      { 
        upsert: true, 
        returnDocument: "after" 
      }
    );
    
    const count = (res.value?.count as number) || 1;
    return count <= max;
    
  } catch (error: any) {
    // Handle duplicate key errors gracefully
    if (error.code === 11000) {
      console.warn("Duplicate key error in rate limiting, allowing request");
      return true;
    }
    
    console.error("Rate limiting failed, allowing request:", error);
    return true;
  }
}