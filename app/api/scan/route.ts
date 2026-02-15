import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Strip data URL prefix for Claude API
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mediaType = imageBase64.startsWith("data:image/png") ? "image/png" : "image/jpeg";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `Analyze this bet slip screenshot. Extract the following information and return ONLY a JSON object with no markdown or extra text:

{
  "title": "Short title for this play (e.g. 'Duke -9.5' or 'Celtics ML')",
  "matchup": "The matchup (e.g. 'Clemson @ Duke', 'Lakers vs Celtics')",
  "betType": "The bet type (e.g. 'Alternate Spread', 'Moneyline', 'Over/Under', 'Player Prop')",
  "odds": "American odds as a string (e.g. '-110', '+150', '-138'). For parlays, use the total parlay odds.",
  "gameTime": "Game time if visible, in format 'YYYY-MM-DDTHH:MM' for datetime-local input. If not clearly visible, leave empty string.",
  "description": "Write a 2-3 sentence analysis of why this is a strong play. Mention the matchup, the bet type, the odds value, and any angle that makes this compelling. Write it in a confident, insider tone like a premium sports betting analyst would. Start with the key stat or angle."
}

Important:
- For the odds, extract the American odds number only (e.g. -138, +150)
- For parlays, use the combined parlay odds
- For the title, be concise — just the team/player and the line
- For the matchup, use "Away @ Home" format
- For the betType, be specific (Alternate Spread, Moneyline, Player Points, etc.)
- For the description, make it sound like an expert breakdown, not generic
- Return ONLY valid JSON, no backticks or explanation`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[SCAN] Claude API error:", err);
      return NextResponse.json({ error: "AI scan failed" }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content
      .map((item: any) => (item.type === "text" ? item.text : ""))
      .filter(Boolean)
      .join("\n");

    // Parse JSON from response
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    console.log("[SCAN] Extracted:", parsed);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("[SCAN] Error:", error);
    return NextResponse.json({ error: "Failed to scan bet slip" }, { status: 500 });
  }
}
