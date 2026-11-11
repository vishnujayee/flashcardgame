import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import crypto from "crypto";

const COOKIE_NAME = "guest_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  return secret;
}

function sign(value: string): string {
  const h = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${value}.${h}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  
  // Create expected signature
  const expected = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  
  // Use timingSafeEqual to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(sig, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    
    // Ensure both buffers are the same length
    if (sigBuffer.length !== expectedBuffer.length) {
      return null;
    }
    
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer) ? value : null;
  } catch {
    return null;
  }
}

export async function getOrCreateGuestId(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const existingCookie = cookieStore.get(COOKIE_NAME);
    
    if (existingCookie?.value) {
      const verifiedValue = verify(existingCookie.value);
      if (verifiedValue) {
        return verifiedValue;
      }
      // Invalid signature, delete the corrupted cookie
      cookieStore.delete(COOKIE_NAME);
    }
    
    // Create new guest ID
    const id = `guest_${nanoid(16)}`;
    const signed = sign(id);
    
    // Set the cookie - using proper Next.js cookie API
    cookieStore.set(COOKIE_NAME, signed, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE
    });
    
    return id;
  } catch (error) {
    // Fallback: generate guest ID without cookie persistence
    console.warn("Failed to handle guest cookie, using ephemeral ID:", error);
    return `ephemeral_guest_${nanoid(16)}_${Date.now()}`;
  }
}

export async function getActorIdOrGuest(userId?: string | null): Promise<string> {
  if (userId) return userId;
  return await getOrCreateGuestId();
}

export async function deleteGuestId(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch (error) {
    console.warn("Failed to delete guest cookie:", error);
  }
}

export async function getGuestIdIfExists(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const existingCookie = cookieStore.get(COOKIE_NAME);
    
    if (existingCookie?.value) {
      const verifiedValue = verify(existingCookie.value);
      if (verifiedValue) {
        return verifiedValue;
      }
      // Invalid signature, delete the corrupted cookie
      cookieStore.delete(COOKIE_NAME);
    }
    
    return null;
  } catch (error) {
    console.warn("Failed to read guest cookie:", error);
    return null;
  }
}

// Utility function to check if an ID is a guest ID
export function isGuestId(id: string): boolean {
  return id.startsWith('guest_') || id.startsWith('ephemeral_guest_');
}