import { NextResponse } from "next/server";

import {
  getDefaultWordsLimit,
  getFilteredWordCount,
  getWords,
  parseWordFilters,
} from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.has("limit")
    ? Number(searchParams.get("limit"))
    : getDefaultWordsLimit();
  const offset = searchParams.has("offset")
    ? Number(searchParams.get("offset"))
    : 0;
  const random = searchParams.get("random") === "true";
  const { filters, error } = parseWordFilters(searchParams);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    const [words, total] = await Promise.all([
      getWords(limit, offset, filters, { random }),
      getFilteredWordCount(filters),
    ]);
    return NextResponse.json({
      data: words,
      meta: {
        limit,
        offset,
        status: filters.learningStatus,
        random,
        total,
        hasMore: offset + words.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to load words", error);

    return NextResponse.json(
      { error: "Failed to load words" },
      { status: 500 },
    );
  }
}
