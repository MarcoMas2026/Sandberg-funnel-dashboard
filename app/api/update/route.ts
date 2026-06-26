import { NextResponse } from "next/server";

export async function POST() {
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { triggered: false, error: "NEXT_PUBLIC_N8N_WEBHOOK_URL is not set" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(webhookUrl, { method: "POST" });

    if (!res.ok) {
      return NextResponse.json(
        { triggered: false, error: `n8n webhook returned ${res.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      triggered: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ triggered: false, error: message }, { status: 500 });
  }
}
