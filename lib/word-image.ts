"use client";

import type { Word } from "@/types/word";

const imageCacheStorageKey = "learn-words:unsplash-image-urls:v1";

export type WordImage = {
  imageUrl: string;
  alt: string;
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
};

function getImageCacheKey(word: string) {
  return word.trim().toLowerCase();
}

function readImageCache() {
  try {
    const cachedValue = window.localStorage.getItem(imageCacheStorageKey);

    if (!cachedValue) {
      return {};
    }

    return JSON.parse(cachedValue) as Record<string, WordImage>;
  } catch {
    return {};
  }
}

function getCachedWordImage(word: string) {
  return readImageCache()[getImageCacheKey(word)] ?? null;
}

function setCachedWordImage(word: string, image: WordImage) {
  try {
    const imageCache = readImageCache();

    window.localStorage.setItem(
      imageCacheStorageKey,
      JSON.stringify({
        ...imageCache,
        [getImageCacheKey(word)]: image,
      }),
    );
  } catch {
    // Image loading should still work when browser storage is unavailable.
  }
}

export async function fetchWordImage(word: Word): Promise<WordImage> {
  const cachedImage = getCachedWordImage(word.wordOrExpression);

  if (cachedImage) {
    return cachedImage;
  }

  const response = await fetch(
    `/api/images?word=${encodeURIComponent(word.wordOrExpression)}`,
  );

  if (!response.ok) {
    throw new Error("No image found");
  }

  const result = (await response.json()) as {
    data?: WordImage;
  };

  if (!result.data?.imageUrl) {
    throw new Error("No image found");
  }

  setCachedWordImage(word.wordOrExpression, result.data);
  return result.data;
}
