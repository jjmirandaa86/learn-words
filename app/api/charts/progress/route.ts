import { NextResponse } from "next/server";

import { getProgressChartData } from "@/lib/queries";

export async function GET() {
  try {
    const data = await getProgressChartData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load progress charts", error);

    return NextResponse.json(
      { error: "Failed to load progress charts" },
      { status: 500 },
    );
  }
}
