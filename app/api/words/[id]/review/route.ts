import { NextResponse } from "next/server";

import { isReviewResult, reviewWord } from "@/lib/queries";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { result?: unknown };

  if (!isReviewResult(body.result)) {
    return NextResponse.json(
      { error: "Invalid review result" },
      { status: 400 },
    );
  }

  try {
    const word = await reviewWord(id, body.result);
    return NextResponse.json({ data: word });
  } catch (error) {
    console.error("Failed to review word", error);

    return NextResponse.json(
      { error: "Failed to review word" },
      { status: 500 },
    );
  }
}
