import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ error: "Missing env vars", hasUrl: !!url, hasToken: !!token });
  }
  try {
    const r = await fetch(url + "/set/test-key/hello", { method: "POST", headers: { Authorization: "Bearer " + token } });
    const d = await r.json();
    const r2 = await fetch(url + "/get/test-key", { headers: { Authorization: "Bearer " + token } });
    const d2 = await r2.json();
    return NextResponse.json({ redis: "connected", set: d, get: d2 });
  } catch (e) {
    return NextResponse.json({ error: "Redis failed" });
  }
}
