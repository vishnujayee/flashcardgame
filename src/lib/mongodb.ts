// lib/mongodb.ts
import { MongoClient, ServerApiVersion } from "mongodb";

let cachedClient: MongoClient | null = null;
let indexesEnsured = false;

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  
  try {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
    });
    
    await client.connect();
    
    // Verify connection
    await client.db().admin().ping();
    console.log("Successfully connected to MongoDB!");
    
    cachedClient = client;
    return client;
    
  } catch (error: any) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || "default-database";
}

export async function ensureIndexes() {
  if (indexesEnsured) return;
  
  try {
    const client = await getMongoClient();
    const db = client.db(getMongoDbName());
    
    await Promise.all([
      // Users collection
      db.collection("users").createIndex({ supabaseUserId: 1 }, { unique: true }),
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      
      // Flashcards collection
      db.collection("flashcards").createIndex({ createdAt: 1 }),
      
      // Queue collection
      db.collection("queue").createIndex({ userId: 1 }, { unique: true }),
      db.collection("queue").createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 15 }),
    //   db.collection("queue").createIndex({ ipHash: 1 }),
      
      // Matches collection
      db.collection("matches").createIndex({ status: 1 }),
      db.collection("matches").createIndex({ "players.userId": 1, status: 1 }),
      
      // Rate limits collection - FIXED: Use explicit index names and handle conflicts
      db.collection("ratelimits").createIndex({ createdAt: 1 }, { 
        expireAfterSeconds: 86400,
        name: "createdAt_ttl"
      }),
      db.collection("ratelimits").createIndex({ key: 1 }, { 
        name: "key_index"
      }),
      db.collection("ratelimits").createIndex({ bucket: 1 }, { 
        name: "bucket_index"
      }),
    ]);
    
    indexesEnsured = true;
    console.log("MongoDB indexes ensured");
    
  } catch (error: any) {
    // Handle index conflicts gracefully
    if (error.code === 85 || error.codeName === 'IndexOptionsConflict' || 
        error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
      console.warn("Index conflict detected, continuing without index creation:", error.message);
      indexesEnsured = true; // Mark as ensured to prevent retries
      return;
    }
    
    console.error("Failed to ensure indexes:", error);
    throw error;
  }
}