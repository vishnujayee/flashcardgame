import type { NextRequest } from "next/server";

export function getClientIp(req: Request | NextRequest): string {
  // x-forwarded-for may contain list; take first
  const hdr = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").trim();
  if (hdr) return hdr.split(",")[0].trim();
  // As a last resort, return placeholder
  return "0.0.0.0";
}


