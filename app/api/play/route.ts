import { NextRequest, NextResponse } from "next/server";
import Whop from "@whop/sdk";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY,
  appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
});

async function redisGet(key: string) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: "no-store",
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key: string, value: string) {
  const res = await fetch(`${REDIS_URL}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: value,
  });
  return res.ok;
}

// GET — return current play data
export async function GET() {
  try {
    const raw = await redisGet("maxbet-play");
    if (!raw) {
      return NextResponse.json({ play: null });
    }
    const play = JSON.parse(raw);
    return NextResponse.json({ play });
  } catch {
    return NextResponse.json({ play: null });
  }
}

// DELETE — admin removes current play
export async function DELETE(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await fetch(REDIS_URL + "/del/maxbet-play", {
      method: "POST",
      headers: { Authorization: "Bearer " + REDIS_TOKEN },
    });
    console.log("[MAXBET] Play deleted");
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[MAXBET] Delete error:", e?.message || e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { imageBase64, gameTime, title } = body;

    if (!imageBase64 || !gameTime) {
      return NextResponse.json(
        { error: "imageBase64 and gameTime are required" },
        { status: 400 }
      );
    }

    const playData = {
      imageBase64,
      gameTime,
      title: title || "Max Bet Play of the Day",
      updatedAt: new Date().toISOString(),
    };

    await redisSet("maxbet-play", JSON.stringify(playData));

    // Send push notification to all users in the experience
    const experienceId = process.env.WHOP_EXPERIENCE_ID;
    if (experienceId) {
      try {
        await whopsdk.notifications.create({
          experience_id: experienceId,
          title: "🔥 Max Bet Play of the Day is LIVE",
          subtitle: playData.title,
          content:
            "Today's highest-conviction pick just dropped. Unlock it before game time!",
        });
        console.log("[MAXBET] Push notification sent");
      } catch (notifErr) {
        console.error("[MAXBET] Push notification failed:", notifErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[MAXBET] Save error:", e?.message || e);
    console.error("[MAXBET] Stack:", e?.stack);
    return NextResponse.json({ error: "Failed to save: " + (e?.message || "unknown") }, { status: 500 });
  }
}
