import { NextResponse } from "next/server";

import {
  getDefaultWordsLimit,
  getFilteredWordCount,
  getWords,
  isLearningStatus,
} from "@/lib/queries";
import type { WordFilters } from "@/types/word";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.has("limit")
    ? Number(searchParams.get("limit"))
    : getDefaultWordsLimit();
  const offset = searchParams.has("offset")
    ? Number(searchParams.get("offset"))
    : 0;
  const status = searchParams.get("status");
  const random = searchParams.get("random") === "true";

  const learningStatus = status && isLearningStatus(status) ? status : undefined;
  const isPhraseParam = searchParams.get("isPhrase");
  const isPhrase =
    isPhraseParam === "0" || isPhraseParam === "1" ? isPhraseParam : undefined;
  const filters: WordFilters = {
    learningStatus,
    cefrLevel: searchParams.get("cefrLevel") || undefined,
    priority: searchParams.get("priority") || undefined,
    wordType: searchParams.get("wordType") || undefined,
    ieltsRelevance: searchParams.get("ieltsRelevance") || undefined,
    theme: searchParams.get("theme") || undefined,
    studyGroup: searchParams.get("studyGroup") || undefined,
    isPhrase,
  };

  if (status && !learningStatus) {
    return NextResponse.json(
      { error: "Invalid learning status" },
      { status: 400 },
    );
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
        status: learningStatus,
        random,
        total,
        hasMore: offset + words.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to load words", error);

    return NextResponse.json(
      { error: "Failed to load words" },
      { status: 500 }
    );
  }
}
