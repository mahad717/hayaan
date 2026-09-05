import { NextResponse } from "next/server";

// Required by Cloudflare Pages — all API routes must run on the Edge Runtime.
export const runtime = "edge";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}