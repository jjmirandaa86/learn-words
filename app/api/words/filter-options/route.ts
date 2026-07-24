import { NextResponse } from "next/server";

import { getWordFilterOptions, parseWordFilters } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { filters, error } = parseWordFilters(searchParams);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    const options = await getWordFilterOptions(filters);

    return NextResponse.json({ data: options });
  } catch (error) {
    console.error("Failed to load filter options", error);

    return NextResponse.json(
      { error: "Failed to load filter options" },
      { status: 500 },
    );
  }
}
