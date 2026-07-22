import { NextResponse } from "next/server";

type UnsplashSearchResponse = {
  results?: Array<{
    urls?: {
      thumb?: string;
      small?: string;
    };
    alt_description?: string | null;
    user?: {
      name?: string;
      links?: {
        html?: string;
      };
    };
    links?: {
      html?: string;
    };
  }>;
};

export async function GET(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim();

  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  if (!accessKey) {
    return NextResponse.json(
      { error: "Missing Unsplash access key" },
      { status: 500 },
    );
  }

  const unsplashUrl = new URL("https://api.unsplash.com/search/photos");
  unsplashUrl.searchParams.set("query", word);
  unsplashUrl.searchParams.set("per_page", "1");
  unsplashUrl.searchParams.set("orientation", "squarish");

  const response = await fetch(unsplashUrl, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unsplash lookup failed" },
      { status: response.status },
    );
  }

  const payload = (await response.json()) as UnsplashSearchResponse;
  const photo = payload.results?.[0];
  const imageUrl = photo?.urls?.thumb ?? photo?.urls?.small;

  if (!photo || !imageUrl) {
    return NextResponse.json({ error: "No image found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      word,
      imageUrl,
      alt: photo.alt_description ?? word,
      photographerName: photo.user?.name ?? "Unsplash",
      photographerUrl: photo.user?.links?.html ?? "https://unsplash.com",
      photoUrl: photo.links?.html ?? "https://unsplash.com",
    },
  });
}
