import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "medintel-frontend",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

