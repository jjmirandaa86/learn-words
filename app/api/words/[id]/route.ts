import { NextResponse } from "next/server";

import { isLearningStatus, updateLearningStatus } from "@/lib/queries";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { learningStatus?: unknown };

  if (!isLearningStatus(body.learningStatus)) {
    return NextResponse.json(
      { error: "Invalid learning status" },
      { status: 400 },
    );
  }

  try {
    const word = await updateLearningStatus(id, body.learningStatus);
    return NextResponse.json({ data: word });
  } catch (error) {
    console.error("Failed to update learning status", error);

    return NextResponse.json(
      { error: "Failed to update learning status" },
      { status: 500 },
    );
  }
}
