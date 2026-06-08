import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originLat = searchParams.get("originLat");
  const originLng = searchParams.get("originLng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");

  if (!originLat || !originLng || !destLat || !destLng) {
    console.error("[API] Missing coordinates");
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("[API] Missing Google Maps API key");
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      console.error(
        "[API] Google API error:",
        data.error_message || data.status,
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch distance" },
      { status: 500 },
    );
  }
}
