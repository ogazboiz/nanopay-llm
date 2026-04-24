import { NextRequest } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8787";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch(`${SERVER}/chain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
