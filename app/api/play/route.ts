import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import Whop from "@whop/sdk";

const DATA_FILE = path.join(process.cwd(), "public", "play-data.json");

const whopsdk = new Whop({
  apiKey: process.env.WHOP_API_KEY,
  appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
});

interface PlayData {
  imageBase64: string;
  gameTime: string; // ISO string
  title: string;
  updatedAt: string;
}

async function getPlayData(): Promise<PlayData | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// GET — return current play data
export async function GET() {
  const play = await getPlayData();
  if (!play) {
    return NextResponse.json({ play: null });
  }
  return NextResponse.json({ play });
}

// POST — admin uploads new play + sends push notification
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

    const playData: PlayData = {
      imageBase64,
      gameTime,
      title: title || "Max Bet Play of the Day",
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(playData), "utf-8");

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
  } catch (e) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
