// lib/user-sync.ts
import { getMongoClient, getMongoDbName } from "./mongodb";
import { UserSchema } from "./schemas";

export async function syncUserToMongoDB(supabaseUserId: string, email: string) {
  try {
    const client = await getMongoClient();
    const db = client.db(getMongoDbName());
    const usersCollection = db.collection("users");

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ 
      $or: [{ supabaseUserId }, { email }] 
    });

    if (!existingUser) {
      // Create new user in MongoDB
      const newUser = UserSchema.parse({
        supabaseUserId,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await usersCollection.insertOne(newUser);
      console.log("Created new user in MongoDB:", email);
    } else if (existingUser.supabaseUserId !== supabaseUserId) {
      // Update existing user with Supabase ID (for migrated users)
      await usersCollection.updateOne(
        { _id: existingUser._id },
        { $set: { supabaseUserId, updatedAt: new Date() } }
      );
    }

  } catch (error) {
    console.error("Failed to sync user to MongoDB:", error);
    // Don't throw - we don't want to break auth flow
  }
}